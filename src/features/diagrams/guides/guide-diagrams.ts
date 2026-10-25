import type { Element, FlowchartShape, GroupElement, ShapeElement } from "../../../model";
import { buildLibraryComponent, LIBRARY_COMPONENTS, type LibraryComponentKind } from "../../../notes";

export type DiagramGuideId = "order-flow" | "class-model" | "sequence" | "data-model" | "bpmn-process" | "c4-context" | "network-edge" | "cloud-service" | "state-machine" | "mind-map" | "user-journey" | "use-case" | "component-architecture" | "deployment" | "api-auth" | "data-flow" | "git-workflow" | "ci-cd" | "threat-model" | "c4-container" | "c4-dynamic" | "kubernetes-cluster" | "data-pipeline" | "incident-response" | "decision-tree";
export type DiagramGuideCategory = "Flowchart" | "UML" | "Database" | "Data flow" | "API" | "BPMN" | "Architecture" | "Network" | "Brainstorming" | "UX" | "DevOps" | "Security" | "Operations";

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
export type DiagramGuideLesson = {
  level: "Starter" | "Intermediate" | "Advanced";
  minutes: number;
  tags: string[];
  steps: string[];
  practices: string[];
  pitfalls: string[];
  related: DiagramGuideId[];
};
type DiagramGuideBlueprint = {
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
export type DiagramGuide = DiagramGuideBlueprint & { lesson: DiagramGuideLesson };

const flowNode = (title: string, x: number, y: number, shape: FlowchartShape, w = 150, h = 78, fill?: string): GuideNode => ({ title, x, y, w, h, shape: "flowchart", flowchartShape: shape, ...(fill ? { fill } : {}) });
const componentNode = (title: string, x: number, y: number, component: LibraryComponentKind, w: number, h: number, fill?: string): GuideNode => ({ title, x, y, w, h, component, fill });

/** Fresh guide definitions: the card art and inserted examples share this source. */
const GUIDE_BLUEPRINTS: DiagramGuideBlueprint[] = [
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
  {
    id: "c4-container", category: "Architecture", title: "C4 container view", summary: "Zoom into one software system to show its applications and data stores.", use: "Use this after the context view when people need to understand the system's major runtime parts.", tip: "Treat containers as running applications or data stores; label each connection with its purpose and protocol.", source: { label: "C4 container diagrams", href: "https://c4model.com/diagrams/container" }, width: 1160, height: 410,
    nodes: [componentNode("Customer", 20, 145, "c4-person", 140, 125, "#fff6df"), { ...componentNode("Online store · system boundary", 205, 22, "c4-system", 720, 340, "#f6f9fd"), background: true }, componentNode("Web app · browser", 265, 95, "software-client", 175, 105, "#e8f2ff"), componentNode("Order API · REST", 520, 95, "software-api", 175, 105, "#e8f2ff"), componentNode("Orders · SQL", 520, 235, "software-database", 175, 105, "#eef8f3"), componentNode("Payment provider", 965, 145, "c4-external-system", 175, 125, "#fff0ee")],
    edges: [{ from: 0, to: 2, label: "Uses the store" }, { from: 2, to: 3, label: "HTTPS / JSON" }, { from: 3, to: 4, label: "Reads and writes orders" }, { from: 3, to: 5, label: "Authorizes payment" }],
  },
  {
    id: "c4-dynamic", category: "Architecture", title: "C4 dynamic view", summary: "Explain how system parts collaborate to complete one important scenario.", use: "Use a dynamic view to make a complex or recurring runtime interaction easier to follow.", tip: "Keep one user story in scope and number interactions in execution order.", source: { label: "C4 dynamic diagrams", href: "https://c4model.com/diagrams/dynamic" }, width: 1120, height: 430,
    nodes: [componentNode("Customer", 25, 24, "uml-lifeline", 155, 370), componentNode("Web app", 255, 24, "uml-lifeline", 155, 370), componentNode("Order service", 485, 24, "uml-lifeline", 175, 370), componentNode("Payment provider", 740, 24, "uml-lifeline", 175, 370), componentNode("Order store", 980, 24, "uml-lifeline", 120, 370)],
    edges: [{ from: 0, to: 1, label: "1 · Submit order", atY: 95 }, { from: 1, to: 2, label: "2 · Create pending order", atY: 155 }, { from: 2, to: 3, label: "3 · Authorize payment", atY: 215 }, { from: 3, to: 2, label: "4 · Approved", dashed: true, atY: 275 }, { from: 2, to: 4, label: "5 · Save confirmed order", atY: 335 }],
  },
  {
    id: "kubernetes-cluster", category: "Architecture", title: "Kubernetes cluster", summary: "Separate control-plane responsibilities from worker workloads.", use: "Use this to orient a team around the cluster's major responsibilities and workload boundary.", tip: "Keep the view conceptual; add node, network, storage, and security detail in focused follow-up diagrams.", source: { label: "Kubernetes cluster architecture", href: "https://kubernetes.io/docs/concepts/architecture/" }, width: 1140, height: 465,
    nodes: [{ ...componentNode("Kubernetes cluster", 235, 22, "c4-system", 865, 405, "#f6f9fd"), background: true }, { ...componentNode("Control plane", 275, 72, "c4-container", 365, 300, "#eef4ff"), background: true }, { ...componentNode("Worker node", 675, 72, "c4-container", 385, 300, "#eef8f3"), background: true }, componentNode("API server", 310, 125, "software-api", 135, 85), componentNode("Scheduler", 465, 125, "software-service", 140, 85), componentNode("Controllers", 385, 255, "software-service", 155, 85), componentNode("Service", 720, 125, "software-service", 130, 85), componentNode("Application pods", 890, 125, "software-service", 145, 85), componentNode("Customer", 20, 155, "c4-person", 140, 120, "#fff6df")],
    edges: [{ from: 8, to: 3, label: "Cluster API" }, { from: 3, to: 4, label: "Schedules workloads" }, { from: 3, to: 5, label: "Reconciles state" }, { from: 6, to: 7, label: "Routes requests" }],
  },
  {
    id: "data-pipeline", category: "Data flow", title: "Data pipeline", summary: "Trace records from collection through processing into reporting.", use: "Use this to discuss ownership, transformations, and storage between a source and its consumers.", tip: "Name the data at each handoff and mark where validation, filtering, or aggregation changes it.", source: { label: "OWASP data-flow modeling guidance", href: "https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html" }, width: 1160, height: 365,
    nodes: [componentNode("App events", 20, 125, "software-service", 165, 110), componentNode("Ingest queue", 235, 125, "software-queue", 165, 110), componentNode("Transform + validate", 455, 125, "software-service", 190, 110), componentNode("Analytics store", 700, 125, "software-database", 180, 110), componentNode("Reports", 935, 125, "software-client", 180, 110)],
    edges: [{ from: 0, to: 1, label: "Events" }, { from: 1, to: 2, label: "Batch / stream" }, { from: 2, to: 3, label: "Clean records" }, { from: 3, to: 4, label: "Aggregates" }],
  },
  {
    id: "incident-response", category: "Operations", title: "Incident response", summary: "Show a clear path from alert triage through recovery and review.", use: "Use this to align the operational handoffs and decision points in an incident process.", tip: "Make escalation ownership, customer communication, and the recovery check explicit.", source: { label: "NIST incident response recommendations", href: "https://csrc.nist.gov/pubs/sp/800/61/r3/final" }, width: 1120, height: 465,
    nodes: [flowNode("Alert received", 20, 180, "terminator", 150, 80), flowNode("Triage + assign owner", 225, 180, "process", 190, 80), flowNode("Customer impact?", 470, 170, "decision", 180, 100), flowNode("Mitigate + communicate", 725, 70, "process", 195, 85), flowNode("Resolve false alarm", 725, 300, "process", 195, 85), flowNode("Verify recovery", 965, 70, "process", 145, 85), flowNode("Review + close", 965, 300, "terminator", 145, 85)],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 3, label: "Yes" }, { from: 2, to: 4, label: "No" }, { from: 3, to: 5 }, { from: 5, to: 6, label: "Stable" }, { from: 5, to: 3, label: "Still failing", dashed: true }],
  },
  {
    id: "decision-tree", category: "Flowchart", title: "Decision tree", summary: "Turn a multi-step choice into visible conditions and outcomes.", use: "Use this when a team needs to explain why different inputs lead to different recommendations.", tip: "Phrase each branch as a testable question and label every outgoing path.", source: { label: "draw.io flowchart shape guide", href: "https://www.drawio.com/docs/manual/shapes/" }, width: 1110, height: 440,
    nodes: [flowNode("Start", 20, 185, "terminator", 125, 70), flowNode("Account active?", 210, 170, "decision", 170, 100), flowNode("Eligible?", 465, 62, "decision", 155, 95), flowNode("Recent activity?", 465, 275, "decision", 175, 95), flowNode("Offer standard plan", 705, 40, "process", 190, 80), flowNode("Offer trial", 705, 155, "process", 190, 80), flowNode("Request reactivation", 705, 285, "process", 190, 80), flowNode("Explain unavailable", 705, 370, "process", 190, 60)],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2, label: "Yes" }, { from: 1, to: 7, label: "No" }, { from: 2, to: 4, label: "Yes" }, { from: 2, to: 5, label: "No" }, { from: 3, to: 6, label: "Yes" }, { from: 3, to: 7, label: "No" }],
  },
];

const lesson = (level: DiagramGuideLesson["level"], minutes: number, tags: string[], steps: string[], practices: string[], pitfalls: string[], related: DiagramGuideId[] = []): DiagramGuideLesson => ({ level, minutes, tags, steps, practices, pitfalls, related });
const GUIDE_LESSONS: Record<DiagramGuideId, DiagramGuideLesson> = {
  "order-flow": lesson("Starter", 8, ["process", "decision", "approval"], ["Set the process start and the result it should reach.", "Place actions in the order they happen.", "Turn each yes-or-no question into a decision with named branches.", "Check that every branch reaches an outcome or loops back intentionally."], ["Use verb-first action labels.", "Keep branch labels beside their connectors."], ["Leaving a path without an outcome.", "Using a decision shape for an action."], ["bpmn-process", "decision-tree"]),
  "class-model": lesson("Intermediate", 12, ["UML", "classes", "domain model"], ["Choose the domain concepts the audience needs.", "Add the key attributes that clarify each class's responsibility.", "Connect classes and state multiplicity at both ends.", "Review ownership and inheritance separately from simple association."], ["Use nouns for class names.", "Keep implementation details out unless they explain the model."], ["Showing database tables as if they were automatically domain classes.", "Leaving relationship counts ambiguous."], ["data-model", "component-architecture"]),
  sequence: lesson("Starter", 10, ["UML", "sequence", "messages"], ["List the participants that take part in one scenario.", "Order participants from the initiating actor toward dependencies.", "Add messages from top to bottom in execution order.", "Show replies or failures when they change the next step."], ["Use message labels that name an action or returned result.", "Keep one scenario per diagram."], ["Mixing unrelated scenarios into one timeline.", "Using vertical position inconsistently."], ["api-auth", "c4-dynamic"]),
  "data-model": lesson("Starter", 10, ["ERD", "database", "keys"], ["Identify entities from the records the system stores.", "Mark primary keys and the foreign keys that connect records.", "Add relationship cardinality and optionality.", "Check that each attribute belongs to the entity that owns it."], ["Use consistent singular entity names.", "Document important constraints near the affected entity."], ["Showing a relationship without its cardinality.", "Adding fields that repeat data already owned elsewhere."], ["class-model", "data-pipeline"]),
  "bpmn-process": lesson("Intermediate", 14, ["BPMN", "business process", "gateway"], ["Define the trigger and the final event.", "Split work into tasks with a clear owner or service.", "Use a gateway only where the flow actually branches or joins.", "Label conditions and verify the sequence flow can reach an end."], ["Use events for things that happen, tasks for work, and gateways for routing.", "Keep each pool or lane tied to a meaningful participant."], ["Using gateways as decorative diamonds.", "Confusing message flow with sequence flow."], ["order-flow", "incident-response"]),
  "c4-context": lesson("Starter", 8, ["C4", "system context", "architecture"], ["Name the single software system in scope.", "Add the people who use or operate it.", "Add external systems it depends on or serves.", "Label each relationship with direction and purpose."], ["Describe elements in plain language for the intended audience.", "Keep implementation detail for a lower-level view."], ["Drawing internal services in a context diagram.", "Using unlabeled or two-way arrows."], ["c4-container", "network-edge"]),
  "network-edge": lesson("Intermediate", 12, ["network", "security", "traffic"], ["Mark the public and private trust zones.", "Place entry controls in the order traffic reaches them.", "Show the destinations that actually serve requests.", "Label protocols and exposed paths."], ["Use one direction convention for all traffic.", "Call out administrative access separately from user traffic."], ["Drawing a firewall without showing what it protects.", "Treating a topology sketch as a full security review."], ["threat-model", "kubernetes-cluster"]),
  "cloud-service": lesson("Intermediate", 12, ["cloud", "runtime", "queues"], ["Set the application boundary and its external callers.", "Place synchronous request handling on the primary path.", "Add queues and workers where work is asynchronous.", "Connect data stores to the services that own the data."], ["Label protocols and asynchronous handoffs.", "Separate runtime components from vendor product names when possible."], ["Using a queue without showing who produces and consumes messages.", "Showing every cloud resource in a high-level view."], ["c4-container", "deployment"]),
  "state-machine": lesson("Intermediate", 10, ["UML", "states", "lifecycle"], ["Choose one object whose lifecycle matters.", "Name stable conditions as states.", "Connect states with events or guards that trigger transitions.", "Check initial, terminal, and re-entry paths."], ["Use state names for conditions and transition labels for events.", "Model errors or cancellation when they change lifecycle behavior."], ["Using states to show actions.", "Leaving a state with no clear exit rule."], ["sequence", "order-flow"]),
  "mind-map": lesson("Starter", 6, ["brainstorming", "ideas", "exploration"], ["Put one topic or question in the center.", "Add first-level themes before writing details.", "Expand the branches that need evidence or action.", "Group, rename, or remove branches after the initial brainstorm."], ["Capture first, organize second.", "Use short phrases so the map stays scannable."], ["Turning every branch into a paragraph.", "Treating untested ideas as decisions."], ["user-journey", "decision-tree"]),
  "user-journey": lesson("Starter", 12, ["UX", "customer journey", "friction"], ["Name the user, context, and goal.", "Map stages in the order the person experiences them.", "Add actions, questions, and friction at each stage.", "Turn evidence-backed friction into improvement opportunities."], ["Separate observed evidence from team assumptions.", "Include before and after the product interaction when relevant."], ["Mapping internal team steps instead of user experience.", "Treating a single persona as every user."], ["use-case", "bpmn-process"]),
  "use-case": lesson("Starter", 9, ["UML", "scope", "actors"], ["Draw the system boundary first.", "Place external actors outside it.", "Name each use case as a user goal inside it.", "Connect actors only to goals they participate in."], ["Keep steps and message order in a sequence or activity view.", "Include supporting systems only when they clarify scope."], ["Using use cases for low-level implementation detail.", "Adding actor-to-actor relationships that are not system interactions."], ["sequence", "c4-context"]),
  "component-architecture": lesson("Intermediate", 14, ["architecture", "components", "interfaces"], ["Choose one application boundary.", "Group implementation behind components with distinct responsibilities.", "Add the interfaces and dependencies that explain collaboration.", "Trace each connector to a real request, event, or data exchange."], ["Show responsibilities and interface direction.", "Split component and deployment views when the audience needs both."], ["Treating deployable applications as components inside one process.", "Showing every class instead of cohesive responsibilities."], ["c4-container", "deployment"]),
  deployment: lesson("Intermediate", 14, ["deployment", "infrastructure", "runtime"], ["Choose one environment or release scenario.", "Place runtime nodes and execution environments.", "Place software artifacts on the nodes that run them.", "Label network paths, regions, and external managed services."], ["Separate deployment concerns from source-code structure.", "Use consistent names for environment, region, and node."], ["Mixing development and production in one view without labels.", "Assuming one cloud provider's icon set is universal notation."], ["cloud-service", "kubernetes-cluster"]),
  "api-auth": lesson("Intermediate", 13, ["API", "OAuth", "authentication"], ["List the client, authorization service, API, and resource owner.", "Show the authorization request and user approval.", "Separate the authorization code exchange from the protected API request.", "Add denial, invalid token, or expiry only when those cases matter."], ["Distinguish identity from permission to access a resource.", "Label where a token is issued, sent, and validated."], ["Sending a token through an untrusted diagram path without explaining protection.", "Treating authentication success as authorization for every action."], ["sequence", "threat-model"]),
  "data-flow": lesson("Intermediate", 12, ["DFD", "data flow", "trust boundary"], ["Identify external entities, processes, and stores.", "Draw each data flow with a direction and data name.", "Mark trust boundaries between owners or privilege levels.", "Review sensitive data and threat prompts at every crossing."], ["Use one connector convention for data movement.", "Keep security controls attached to the flow they protect."], ["Drawing dependencies as if they were data movement.", "Omitting a store or external party from a sensitive flow."], ["threat-model", "data-pipeline"]),
  "git-workflow": lesson("Starter", 8, ["Git", "branches", "review"], ["Choose the stable branch and a representative change.", "Show where the feature branch starts.", "Add commits, review, and automated checks in sequence.", "Mark the merge condition and what happens after approval."], ["Tailor the path to your repository's actual policy.", "Use this as a team agreement, not a universal branching rule."], ["Showing review without a place for requested changes.", "Assuming all teams need long-lived feature branches."], ["ci-cd", "incident-response"]),
  "ci-cd": lesson("Intermediate", 11, ["CI/CD", "automation", "release"], ["Mark the event that starts the workflow.", "Show required checks and which jobs can run in parallel.", "Pass a named artifact between build and release stages.", "Add approval, deployment environments, and a recovery path."], ["Name the artifact once and keep the name consistent.", "Show gates that really block promotion."], ["Drawing a test stage without defining its pass condition.", "Treating deployment as complete without a health check."], ["git-workflow", "deployment"]),
  "threat-model": lesson("Intermediate", 16, ["STRIDE", "security", "risk review"], ["Set system scope and identify its important assets.", "Map entities, processes, stores, flows, and trust boundaries.", "Use STRIDE prompts on each relevant element and flow.", "Record threat, impact, mitigation, owner, and review status."], ["Revisit the model when architecture or data flow changes.", "Prioritize threats by likelihood and impact in system context."], ["Treating the STRIDE list as an exhaustive security assessment.", "Listing threats without owners or actionable mitigations."], ["data-flow", "network-edge"]),
  "c4-container": lesson("Intermediate", 12, ["C4", "containers", "system architecture"], ["Start from a context view and retain its system boundary.", "Add the major applications and data stores inside the system.", "Add only external systems that directly connect to those containers.", "Label every relationship with purpose and protocol."], ["Treat a container as a running application or data store, not a package or folder.", "Stop at the level that answers the audience's question."], ["Mixing components inside a container with deployable containers.", "Adding cloud infrastructure that obscures the software structure."], ["c4-context", "component-architecture"]),
  "c4-dynamic": lesson("Intermediate", 11, ["C4", "runtime", "sequence"], ["Choose one feature or use case.", "Reuse the relevant systems, containers, or components.", "Number interactions in order and label their intent.", "Stop when the scenario's outcome is clear."], ["Use sparingly for interactions that benefit from explanation.", "Use sequence or communication layout based on readability."], ["Turning a static dependency map into a runtime story.", "Showing unrelated requests in the same execution order."], ["sequence", "c4-container"]),
  "kubernetes-cluster": lesson("Advanced", 16, ["Kubernetes", "cluster", "workloads"], ["Draw the cluster boundary.", "Separate control-plane responsibilities from worker nodes.", "Place workloads in the worker area and show the service route.", "Add storage, ingress, or node detail only when the question needs it."], ["Use official component names accurately.", "Label which elements are conceptual abstractions versus deployed instances."], ["Treating a Service as the same object as a Pod.", "Trying to document every cluster resource on one page."], ["deployment", "network-edge"]),
  "data-pipeline": lesson("Intermediate", 12, ["ETL", "streaming", "data engineering"], ["Name the source and its record or event.", "Show buffering, processing, and validation stages.", "Mark durable storage and who owns its schema.", "Connect reports or downstream consumers to the data they use."], ["Distinguish streaming from scheduled batches.", "Label transformations and retention boundaries."], ["Assuming queued data is already validated.", "Leaving out failed, delayed, or replayed data paths when important."], ["data-flow", "data-model"]),
  "incident-response": lesson("Intermediate", 12, ["operations", "incident", "escalation"], ["Define the alert that starts response.", "Assign triage and incident ownership.", "Branch on impact or severity using clear criteria.", "Show mitigation, recovery verification, communication, and closure."], ["Make decision ownership visible.", "Keep investigation and recovery distinct where that helps coordination."], ["Closing an incident before confirming recovery.", "Escalating without identifying who takes ownership."], ["bpmn-process", "ci-cd"]),
  "decision-tree": lesson("Starter", 9, ["decision", "rules", "outcomes"], ["Start with the decision the diagram should help make.", "Write branch conditions as questions that can be answered.", "Connect each answer to the next question or outcome.", "Walk through sample inputs to verify every route."], ["Keep branch labels mutually clear.", "Use outcome names that explain what happens next."], ["Leaving a branch unlabeled.", "Creating loops where the decision should terminate."], ["order-flow", "mind-map"]),
};

export const DIAGRAM_GUIDES: DiagramGuide[] = GUIDE_BLUEPRINTS.map(guide => ({ ...guide, lesson: GUIDE_LESSONS[guide.id] }));

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
