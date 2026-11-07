import type { Element, GroupElement, LibraryChartData, LibraryChartKind, LibraryComponentFieldValue, RelationshipType, ShapeElement, TextElement } from "../../model";
import { CLOUD_NEUTRAL_COMPONENTS, CLOUD_PROVIDER_COMPONENTS, cloudProviderComponent, type CloudNeutralComponentKind, type CloudProviderComponentKind } from "../diagrams/cloud-providers";
import { defaultUiComponentRecord, UI_COMPONENT_DEFINITIONS, isUiComponentKind, type UiComponentKind } from "./ui-components";
import { componentGeometry, snapComponentSize, type ComponentGeometryDefinition } from "./component-geometry";
import { PROPOSAL_COMPONENTS, proposalComponentFields, proposalComponentForKind, type ProposalComponentKind } from "./proposal-components";

const text = (x: number, y: number, value: string, color = "#303638", size = 14, family: TextElement["fontFamily"] = "sans", bold = false): TextElement => ({
  type: "text", x, y, text: value, color, fontSize: size, fontFamily: family, bold, textAlign: "left", listType: "none",
});

const rect = (x: number, y: number, w: number, h: number, fill: string, color: string, radius = 12): ShapeElement => ({
  type: "rectangle", x, y, w, h, color, thickness: 1.4, fillColor: fill, fillOpacity: 1, edgeStyle: "rounded", cornerRadius: radius,
});

type BaseLibraryComponentKind = "diagram-frame" | "diagram-swimlane" | "uml-class" | "uml-lifeline" | "uml-activation" | "uml-inheritance" | "uml-realization" | "uml-aggregation" | "uml-composition" | "uml-actor" | "uml-use-case" | "uml-package" | "uml-interface" | "uml-state" | "uml-initial-state" | "uml-final-state" | "uml-fork" | "uml-join" | "uml-component" | "uml-node" | "uml-artifact" | "uml-enumeration" | "sequence-sync" | "sequence-async" | "er-table" | "er-entity" | "er-weak-entity" | "er-associative-entity" | "er-relationship" | "er-identifying-relationship" | "er-attribute" | "er-composite-attribute" | "er-key-attribute" | "er-partial-key-attribute" | "er-multivalued-attribute" | "er-derived-attribute" | "er-one-one" | "er-one-many" | "er-many-one" | "er-many-many" | "c4-system" | "c4-software-system" | "c4-container" | "c4-component" | "c4-person" | "c4-external-system" | "c4-deployment-node" | "tech-service" | "data-flow" | "diagram-legend" | "network-zone" | "bpmn-start" | "bpmn-message-event" | "bpmn-timer-event" | "bpmn-error-event" | "bpmn-signal-event" | "bpmn-terminate-event" | "bpmn-event" | "bpmn-end" | "bpmn-boundary-event" | "bpmn-gateway" | "bpmn-parallel-gateway" | "bpmn-inclusive-gateway" | "bpmn-event-gateway" | "bpmn-task" | "bpmn-user-task" | "bpmn-service-task" | "bpmn-script-task" | "bpmn-call-activity" | "bpmn-subprocess" | "bpmn-data" | "bpmn-data-store" | "bpmn-text-annotation" | "bpmn-pool" | "network-router" | "network-server" | "network-firewall" | "network-client" | "network-switch" | "network-hub" | "network-load-balancer" | "network-proxy" | "network-bridge" | "network-bastion" | "network-gateway" | "network-printer" | "network-workstation" | "network-access-point" | "network-internet" | "network-vpn" | "network-dns" | "network-nat-gateway" | "network-modem" | LibraryChartKind | UiComponentKind | "software-client" | "software-api" | "software-service" | "software-database" | "software-queue" | "software-event-bus" | "software-cache" | "cloud-boundary" | "cloud-function" | "cloud-storage" | "cloud-database" | "cloud-queue" | "uml-association" | "uml-dependency" | "uml-include" | "uml-extend" | "c4-code-element" | "c4-infrastructure-node" | "bpmn-manual-task" | "bpmn-business-rule-task" | "bpmn-send-task" | "bpmn-receive-task" | "network-subnet" | CloudProviderComponentKind | CloudNeutralComponentKind;
export type LibraryComponentKind = BaseLibraryComponentKind | "db-view" | "db-index" | "db-procedure" | "uml-object" | "uml-activity-action" | "uml-activity-decision" | "uml-activity-initial" | "uml-activity-final" | "c4-container-instance" | "c4-component-instance" | "bpmn-group" | ProposalComponentKind;
type LibraryComponentDefinition = { kind: LibraryComponentKind; section: string; label: string; description: string; width: number; height: number; geometry: ComponentGeometryDefinition };
const COMPONENT_CATALOG: Omit<LibraryComponentDefinition, "geometry">[] = [
  { kind: "diagram-frame", section: "General | Layout", label: "Frame", description: "Resizable titled boundary for any diagram", width: 420, height: 280 },
  { kind: "diagram-swimlane", section: "General | Layout", label: "Swimlane", description: "Resizable lanes for organizing responsibilities or stages", width: 520, height: 320 },
  { kind: "uml-class", section: "UML | Classes & sequence", label: "Class card", description: "Name, attributes, and methods compartments", width: 230, height: 154 },
  { kind: "uml-object", section: "UML | Objects", label: "Object instance", description: "Named instance with classifier, state, and slot values", width: 210, height: 142 },
  { kind: "uml-lifeline", section: "UML | Classes & sequence", label: "Lifeline", description: "Participant header and dashed lifeline", width: 154, height: 250 },
  { kind: "uml-activation", section: "UML | Classes & sequence", label: "Activation bar", description: "Sequence activation marker", width: 28, height: 82 },
  { kind: "sequence-sync", section: "UML | Classes & sequence", label: "Sync message", description: "Solid synchronous message arrow", width: 184, height: 50 },
  { kind: "sequence-async", section: "UML | Classes & sequence", label: "Async message", description: "Open asynchronous message arrow", width: 184, height: 50 },
  { kind: "uml-interface", section: "UML | Classes & sequence", label: "Interface", description: "Interface with operations compartment", width: 190, height: 124 },
  { kind: "uml-enumeration", section: "UML | Classes & sequence", label: "Enumeration", description: "Enumeration classifier with literal compartment", width: 190, height: 132 },
  { kind: "uml-state", section: "UML | State machines", label: "State", description: "Rounded UML state with room for entry or exit actions", width: 170, height: 104 },
  { kind: "uml-initial-state", section: "UML | State machines", label: "Initial state", description: "Filled initial pseudostate", width: 54, height: 54 },
  { kind: "uml-final-state", section: "UML | State machines", label: "Final state", description: "Bullseye final pseudostate", width: 58, height: 58 },
  { kind: "uml-fork", section: "UML | State machines", label: "Fork", description: "Fork bar for concurrent state transitions", width: 140, height: 24 },
  { kind: "uml-join", section: "UML | State machines", label: "Join", description: "Join bar for synchronizing concurrent transitions", width: 140, height: 24 },
  { kind: "uml-activity-initial", section: "UML | Activity diagrams", label: "Activity initial node", description: "Control-flow start marker for an activity", width: 54, height: 54 },
  { kind: "uml-activity-action", section: "UML | Activity diagrams", label: "Action", description: "Executable activity step with inputs and outputs", width: 190, height: 100 },
  { kind: "uml-activity-decision", section: "UML | Activity diagrams", label: "Decision / merge", description: "Decision or merge node with an editable condition and guards", width: 100, height: 100 },
  { kind: "uml-activity-final", section: "UML | Activity diagrams", label: "Activity final node", description: "Bullseye marker that ends the whole activity", width: 54, height: 54 },
  { kind: "uml-component", section: "UML | Structure", label: "Component", description: "Component classifier with UML component tabs", width: 190, height: 116 },
  { kind: "uml-node", section: "UML | Structure", label: "Node", description: "Three-dimensional deployment node", width: 190, height: 130 },
  { kind: "uml-artifact", section: "UML | Structure", label: "Artifact", description: "Folded-corner deployment artifact", width: 160, height: 110 },
  { kind: "uml-inheritance", section: "UML | Relationships", label: "Inheritance", description: "Straight connector with a hollow arrowhead", width: 184, height: 42 },
  { kind: "uml-realization", section: "UML | Relationships", label: "Realization", description: "Straight dashed connector with a hollow arrowhead", width: 184, height: 42 },
  { kind: "uml-aggregation", section: "UML | Relationships", label: "Aggregation", description: "Straight connector with an open diamond endpoint", width: 184, height: 42 },
  { kind: "uml-composition", section: "UML | Relationships", label: "Composition", description: "Straight connector with a filled diamond endpoint", width: 184, height: 42 },
  { kind: "uml-association", section: "UML | Relationships", label: "Association", description: "Structural relationship between classifiers", width: 184, height: 42 },
  { kind: "uml-dependency", section: "UML | Relationships", label: "Dependency", description: "Dashed dependency arrow between classifiers", width: 184, height: 42 },
  { kind: "uml-include", section: "UML | Use cases", label: "Include", description: "Dashed include relationship between use cases", width: 184, height: 42 },
  { kind: "uml-extend", section: "UML | Use cases", label: "Extend", description: "Dashed extension relationship between use cases", width: 184, height: 42 },
  { kind: "uml-actor", section: "UML | Use cases", label: "Actor", description: "Use case actor with an editable role and goal", width: 76, height: 116 },
  { kind: "uml-use-case", section: "UML | Use cases", label: "Use case", description: "Use case ellipse with an outcome", width: 190, height: 102 },
  { kind: "uml-package", section: "UML | Use cases", label: "Package", description: "Package boundary for grouped model elements", width: 190, height: 132 },
  { kind: "er-table", section: "ER | Entities & relations", label: "Table schema card", description: "Table with key, field, and type rows", width: 220, height: 156 },
  { kind: "db-view", section: "Database | Relational objects", label: "View", description: "Saved query with source tables and refresh behavior", width: 208, height: 132 },
  { kind: "db-index", section: "Database | Relational objects", label: "Index", description: "Index definition with method, ordered columns, and predicate", width: 208, height: 128 },
  { kind: "db-procedure", section: "Database | Programmable objects", label: "Stored procedure", description: "Database routine with signature, transaction behavior, and side effects", width: 220, height: 142 },
  { kind: "er-entity", section: "ER | Entities & relations", label: "Entity", description: "Editable entity rectangle", width: 148, height: 82 },
  { kind: "er-weak-entity", section: "ER | Entities & relations", label: "Weak entity", description: "Entity with a double boundary", width: 148, height: 82 },
  { kind: "er-associative-entity", section: "ER | Entities & relations", label: "Associative entity", description: "Entity marked with an embedded relationship symbol", width: 170, height: 92 },
  { kind: "er-relationship", section: "ER | Entities & relations", label: "Relationship", description: "Editable relationship diamond", width: 148, height: 88 },
  { kind: "er-identifying-relationship", section: "ER | Entities & relations", label: "Identifying relationship", description: "Relationship with a double boundary", width: 148, height: 88 },
  { kind: "er-attribute", section: "ER | Attributes", label: "Attribute", description: "Editable attribute oval", width: 148, height: 70 },
  { kind: "er-composite-attribute", section: "ER | Attributes", label: "Composite attribute", description: "Parent attribute with two editable child attributes", width: 220, height: 140 },
  { kind: "er-key-attribute", section: "ER | Attributes", label: "Key attribute", description: "Underlined primary key attribute", width: 148, height: 70 },
  { kind: "er-partial-key-attribute", section: "ER | Attributes", label: "Partial key attribute", description: "Dashed, underlined discriminator for a weak entity", width: 148, height: 70 },
  { kind: "er-multivalued-attribute", section: "ER | Attributes", label: "Multivalued attribute", description: "Attribute with a double boundary", width: 148, height: 70 },
  { kind: "er-derived-attribute", section: "ER | Attributes", label: "Derived attribute", description: "Dashed attribute oval", width: 148, height: 70 },
  { kind: "er-one-one", section: "ER | Relationships", label: "One to one", description: "Straight connector with one markers at both ends", width: 190, height: 20 },
  { kind: "er-one-many", section: "ER | Entities & relations", label: "One to many", description: "Straight connector with one and crow's foot endpoints", width: 190, height: 20 },
  { kind: "er-many-one", section: "ER | Relationships", label: "Many to one", description: "Straight connector with a crow's foot and one marker", width: 190, height: 20 },
  { kind: "er-many-many", section: "ER | Entities & relations", label: "Many to many", description: "Straight connector with crow's foot endpoints", width: 190, height: 20 },
  { kind: "c4-system", section: "Architecture | C4 boundaries", label: "System boundary", description: "C4 system context enclosure", width: 300, height: 190 },
  { kind: "c4-software-system", section: "Architecture | C4 people & systems", label: "Software system", description: "System that delivers a capability to its users and integrates with other systems", width: 220, height: 120 },
  { kind: "c4-container-instance", section: "Architecture | C4 elements", label: "C4 container", description: "Deployable application or data store with responsibility and technology", width: 220, height: 128 },
  { kind: "c4-component-instance", section: "Architecture | C4 elements", label: "C4 component", description: "Module inside a container with responsibility and interface", width: 208, height: 124 },
  { kind: "c4-container", section: "Architecture | C4 boundaries", label: "Container boundary", description: "C4 container enclosure", width: 250, height: 156 },
  { kind: "c4-component", section: "Architecture | C4 boundaries", label: "Component boundary", description: "C4 component enclosure", width: 210, height: 132 },
  { kind: "c4-person", section: "Architecture | C4 people & systems", label: "Person", description: "Person or user interacting with a software system", width: 126, height: 122 },
  { kind: "c4-external-system", section: "Architecture | C4 people & systems", label: "External system", description: "External software system or integration", width: 190, height: 104 },
  { kind: "c4-deployment-node", section: "Architecture | Deployment", label: "Deployment node", description: "Host, virtual machine, or runtime that contains deployed software", width: 220, height: 144 },
  { kind: "c4-infrastructure-node", section: "Architecture | Deployment", label: "Infrastructure node", description: "Infrastructure that hosts deployed software, such as a load balancer or DNS service", width: 220, height: 144 },
  { kind: "c4-code-element", section: "Architecture | Code", label: "Code element", description: "Code-level class, interface, object, function, or database table", width: 210, height: 132 },
  { kind: "software-client", section: "Software | Application components", label: "Web client", description: "Browser client with editable interface panels", width: 176, height: 112 },
  { kind: "software-api", section: "Software | Application components", label: "API endpoint", description: "HTTP operation with method, path, request, response, and security details", width: 236, height: 158 },
  { kind: "software-service", section: "Software | Application components", label: "Application service", description: "Service node with a clear module badge", width: 176, height: 92 },
  { kind: "software-database", section: "Software | Data components", label: "Database", description: "Editable application database node", width: 152, height: 118 },
  { kind: "software-queue", section: "Software | Messaging & cache", label: "Message queue", description: "Queue with message slots and flow direction", width: 172, height: 88 },
  { kind: "software-event-bus", section: "Software | Messaging & cache", label: "Event bus", description: "Shared event channel with publisher and subscriber ports", width: 196, height: 96 },
  { kind: "software-cache", section: "Software | Messaging & cache", label: "Cache", description: "Fast key-value cache component", width: 156, height: 88 },
  { kind: "tech-service", section: "Software | Application components", label: "Technology service", description: "Service with technology tag and data flow", width: 174, height: 92 },
  { kind: "data-flow", section: "Software | Connectors & boundaries", label: "Data flow", description: "Directional data pipeline arrow", width: 202, height: 46 },
  { kind: "diagram-legend", section: "Annotations & aids", label: "Legend", description: "Editable key for diagram colors and object types", width: 210, height: 120 },
  { kind: "cloud-boundary", section: "Cloud | Deployment", label: "Cloud boundary", description: "Provider-neutral deployment or region enclosure", width: 300, height: 190 },
  { kind: "cloud-function", section: "Cloud | Services", label: "Cloud function", description: "Serverless function service node", width: 152, height: 96 },
  { kind: "cloud-storage", section: "Cloud | Services", label: "Object storage", description: "Provider-neutral object storage component", width: 156, height: 104 },
  { kind: "cloud-database", section: "Cloud | Services", label: "Managed database", description: "Managed relational database component", width: 156, height: 108 },
  { kind: "cloud-queue", section: "Cloud | Services", label: "Cloud queue", description: "Managed asynchronous message queue", width: 156, height: 94 },
  ...CLOUD_NEUTRAL_COMPONENTS.map(component => ({ kind: component.kind, section: component.section, label: component.label, description: component.description, width: 176, height: 58 })),
  ...CLOUD_PROVIDER_COMPONENTS.map(component => ({ kind: component.kind, section: `Cloud | ${component.provider}`, label: component.label, description: component.description, width: 176, height: 108 })),
  { kind: "network-zone", section: "Network | Devices & zones", label: "Network zone", description: "Infrastructure enclosure with connection points", width: 280, height: 168 },
  { kind: "network-subnet", section: "Network | Devices & zones", label: "Subnet", description: "IP subnet boundary with room for member devices", width: 280, height: 168 },
  { kind: "network-router", section: "Network | Devices", label: "Router", description: "Network router with directional ports", width: 104, height: 86 },
  { kind: "network-switch", section: "Network | Devices", label: "Switch", description: "Ethernet switch with visible ports", width: 132, height: 78 },
  { kind: "network-hub", section: "Network | Devices", label: "Hub", description: "Central network hub with configurable connection ports", width: 144, height: 94 },
  { kind: "network-firewall", section: "Network | Devices", label: "Firewall", description: "Firewall device with segmented face", width: 116, height: 92 },
  { kind: "network-load-balancer", section: "Network | Devices", label: "Load balancer", description: "Traffic distributor with multiple outputs", width: 156, height: 98 },
  { kind: "network-server", section: "Network | Devices", label: "Server", description: "Stacked server node", width: 104, height: 118 },
  { kind: "network-client", section: "Network | Devices", label: "Client device", description: "Desktop client device", width: 118, height: 94 },
  { kind: "network-access-point", section: "Network | Devices", label: "Wireless access point", description: "Ceiling mounted access point puck with radio and status lights", width: 132, height: 98 },
  { kind: "viz-bar", section: "Data visualization | Charts", label: "Bar chart", description: "Compact comparison chart with sample series", width: 260, height: 176 },
  { kind: "viz-horizontal-bar", section: "Data visualization | Charts", label: "Horizontal bar chart", description: "Rank categories with long labels", width: 260, height: 176 },
  { kind: "viz-stacked-bar", section: "Data visualization | Charts", label: "Stacked bar chart", description: "Compare totals and their component series", width: 280, height: 190 },
  { kind: "viz-line", section: "Data visualization | Charts", label: "Line chart", description: "Trend chart with editable points and axis labels", width: 260, height: 176 },
  { kind: "viz-area", section: "Data visualization | Charts", label: "Area chart", description: "Filled trend bands for comparing totals", width: 260, height: 176 },
  { kind: "viz-scatter", section: "Data visualization | Charts", label: "Scatter plot", description: "Point cloud for comparing two measures", width: 260, height: 176 },
  { kind: "viz-pie", section: "Data visualization | Charts", label: "Pie chart", description: "Category proportions with an editable legend", width: 260, height: 176 },
  { kind: "viz-donut", section: "Data visualization | Charts", label: "Doughnut chart", description: "Category proportions with a central total", width: 260, height: 176 },
  { kind: "viz-radar", section: "Data visualization | Charts", label: "Radar chart", description: "Compare several profiles across shared measures", width: 280, height: 210 },
  { kind: "viz-gauge", section: "Data visualization | Charts", label: "Gauge chart", description: "Show progress against a chosen maximum", width: 220, height: 170 },
  { kind: "viz-funnel", section: "Data visualization | Charts", label: "Funnel chart", description: "Show stage values through a process", width: 260, height: 190 },
  { kind: "viz-heatmap", section: "Data visualization | Charts", label: "Heatmap", description: "Compare values across rows and categories", width: 300, height: 210 },
  { kind: "viz-treemap", section: "Data visualization | Charts", label: "Treemap", description: "Compare hierarchical category sizes", width: 280, height: 190 },
  { kind: "viz-kpi", section: "Data visualization | Metrics", label: "Metric card", description: "Headline value, trend, and supporting caption", width: 220, height: 126 },
  ...UI_COMPONENT_DEFINITIONS,
  { kind: "bpmn-start", section: "BPMN | Events & flow", label: "Start event", description: "BPMN start event with a visible trigger", width: 96, height: 92 },
  { kind: "bpmn-message-event", section: "BPMN | Events & flow", label: "Message event", description: "BPMN message trigger or result event", width: 96, height: 92 },
  { kind: "bpmn-timer-event", section: "BPMN | Events & flow", label: "Timer event", description: "BPMN timer trigger event with an expression", width: 96, height: 92 },
  { kind: "bpmn-error-event", section: "BPMN | Events & flow", label: "Error event", description: "BPMN error event with an error code", width: 96, height: 92 },
  { kind: "bpmn-signal-event", section: "BPMN | Events & flow", label: "Signal event", description: "BPMN signal event for broadcast process flow", width: 96, height: 92 },
  { kind: "bpmn-terminate-event", section: "BPMN | Events & flow", label: "Terminate event", description: "BPMN event that ends the current process instance", width: 96, height: 92 },
  { kind: "bpmn-event", section: "BPMN | Events & flow", label: "Intermediate event", description: "BPMN intermediate event with a named definition", width: 96, height: 92 },
  { kind: "bpmn-end", section: "BPMN | Events & flow", label: "End event", description: "BPMN end event with a business outcome", width: 96, height: 92 },
  { kind: "bpmn-boundary-event", section: "BPMN | Events & flow", label: "Boundary event", description: "Event marker with a trigger attached to a task boundary", width: 96, height: 98 },
  { kind: "bpmn-gateway", section: "BPMN | Events & flow", label: "Exclusive gateway", description: "BPMN exclusive decision gateway", width: 58, height: 58 },
  { kind: "bpmn-parallel-gateway", section: "BPMN | Events & flow", label: "Parallel gateway", description: "BPMN parallel split or join gateway", width: 58, height: 58 },
  { kind: "bpmn-inclusive-gateway", section: "BPMN | Events & flow", label: "Inclusive gateway", description: "BPMN gateway for one or more selected paths", width: 58, height: 58 },
  { kind: "bpmn-event-gateway", section: "BPMN | Events & flow", label: "Event gateway", description: "BPMN event-based routing gateway", width: 58, height: 58 },
  { kind: "bpmn-task", section: "BPMN | Tasks & data", label: "Task", description: "BPMN activity task", width: 168, height: 82 },
  { kind: "bpmn-user-task", section: "BPMN | Tasks & data", label: "User task", description: "Human work completed with a task or form", width: 168, height: 82 },
  { kind: "bpmn-service-task", section: "BPMN | Tasks & data", label: "Service task", description: "Automated work performed by a service", width: 168, height: 82 },
  { kind: "bpmn-script-task", section: "BPMN | Tasks & data", label: "Script task", description: "Automated work performed by an embedded script", width: 168, height: 82 },
  { kind: "bpmn-manual-task", section: "BPMN | Tasks & data", label: "Manual task", description: "Work performed by a person without a workflow engine", width: 168, height: 82 },
  { kind: "bpmn-business-rule-task", section: "BPMN | Tasks & data", label: "Business rule task", description: "Task that evaluates a business rule or decision table", width: 168, height: 82 },
  { kind: "bpmn-send-task", section: "BPMN | Tasks & data", label: "Send task", description: "Task that sends a message to another participant", width: 168, height: 82 },
  { kind: "bpmn-receive-task", section: "BPMN | Tasks & data", label: "Receive task", description: "Task that waits for a message from another participant", width: 168, height: 82 },
  { kind: "bpmn-call-activity", section: "BPMN | Tasks & data", label: "Call activity", description: "Reusable called process or global task", width: 168, height: 82 },
  { kind: "bpmn-subprocess", section: "BPMN | Tasks & data", label: "Subprocess", description: "Collapsed BPMN subprocess with expand marker", width: 168, height: 90 },
  { kind: "bpmn-data", section: "BPMN | Tasks & data", label: "Data object", description: "BPMN document data object", width: 86, height: 112 },
  { kind: "bpmn-data-store", section: "BPMN | Tasks & data", label: "Data store", description: "Persistent data available beyond one process instance", width: 120, height: 90 },
  { kind: "bpmn-text-annotation", section: "BPMN | Tasks & data", label: "Text annotation", description: "Annotation connected to a flow object", width: 190, height: 90 },
  { kind: "bpmn-group", section: "BPMN | Tasks & data", label: "Group artifact", description: "Dashed grouping boundary for related process elements", width: 220, height: 132 },
  { kind: "bpmn-pool", section: "BPMN | Tasks & data", label: "Pool / lane", description: "BPMN participant pool with a lane divider", width: 300, height: 156 },
  { kind: "network-internet", section: "Network | Devices", label: "Internet", description: "External internet or public network cloud", width: 128, height: 92 },
  { kind: "network-vpn", section: "Network | Devices", label: "VPN tunnel", description: "Encrypted site-to-site or client VPN path", width: 164, height: 88 },
  { kind: "network-dns", section: "Network | Devices", label: "DNS server", description: "Name resolution service node", width: 120, height: 100 },
  { kind: "network-nat-gateway", section: "Network | Devices", label: "NAT gateway", description: "Address translation between private and public networks", width: 156, height: 100 },
  { kind: "network-modem", section: "Network | Devices", label: "Modem", description: "Network access modem with status and radio marks", width: 120, height: 88 },
  { kind: "network-proxy", section: "Network | Security", label: "Proxy", description: "Intermediary that forwards client requests to services", width: 150, height: 96 },
  { kind: "network-bridge", section: "Network | Devices", label: "Bridge", description: "Layer-two bridge between network segments", width: 150, height: 96 },
  { kind: "network-bastion", section: "Network | Security", label: "Bastion host", description: "Hardened access host at a protected network boundary", width: 158, height: 112 },
  { kind: "network-gateway", section: "Network | Devices", label: "Gateway", description: "Gateway connecting two network domains", width: 150, height: 96 },
  { kind: "network-printer", section: "Network | Devices", label: "Printer", description: "Shared network printer endpoint", width: 130, height: 102 },
  { kind: "network-workstation", section: "Network | Devices", label: "Workstation", description: "User workstation on a local network", width: 150, height: 112 },
  ...PROPOSAL_COMPONENTS.map(({ kind, section, label, description, width, height, archetype }) => {
    const systems = section.startsWith("Systems engineering");
    return {
      kind, section, label, description,
      width: archetype === "connector" ? width : Math.max(width, systems ? archetype === "boundary" ? 280 : 245 : archetype === "boundary" || archetype === "screen" ? 250 : 210),
      height: archetype === "connector" ? height : Math.max(height, systems ? archetype === "boundary" ? 220 : archetype === "event" ? 176 : 190 : archetype === "boundary" || archetype === "screen" ? 190 : archetype === "event" || archetype === "decision" ? 160 : 150),
    };
  }),
];
export const LIBRARY_COMPONENTS: LibraryComponentDefinition[] = COMPONENT_CATALOG.map(component => {
  const { w: width, h: height } = snapComponentSize(component.kind, component.width, component.height);
  return { ...component, width, height, geometry: componentGeometry(component.kind, width, height) };
});
const lineElement = (x: number, y: number, w: number, h: number, color = "#74889a", dashed = false): ShapeElement => ({ type: "line", x, y, w, h, color, thickness: 1.4, lineStyle: dashed ? "dashed" : "solid", startHead: "none", endHead: "none" });

export function buildLibraryRelationship(kind: LibraryComponentKind, x: number, y: number): ShapeElement | undefined {
  const width = LIBRARY_COMPONENTS.find(item => item.kind === kind)?.width;
  const height = LIBRARY_COMPONENTS.find(item => item.kind === kind)?.height;
  if (!width || !height) return undefined;
  const proposal = proposalComponentForKind(kind);
  if (proposal?.archetype === "connector") {
    const planningDependency = kind === "proposal-planning-dependency-connector";
    const noArrow = /composite-part-connector|parametric-constraint/.test(kind);
    const messageFlow = kind.endsWith("bpmn-message-flow");
    const dataAssociation = kind.endsWith("data-association");
    const dashed = messageFlow || !planningDependency && /decomposition|derive|refine|trace|dependency|import|merge|invocation|verify-link|satisfy-link|allocation-relationship/.test(kind);
    const relationshipType: RelationshipType = /item-flow|lineage|data-association|bpmn-message-flow/.test(kind) ? "data-flow" : /communication-message/.test(kind) ? "sequence" : /requirement|allocation|dependency|decision|invocation|package-import|package-merge/.test(kind) ? "dependency" : "association";
    const stereotype = kind.endsWith("requirement-decomposition-link") ? "<<deriveReqt>>"
      : kind.endsWith("requirement-satisfy-link") ? "<<satisfy>>"
        : kind.endsWith("requirement-verify-link") ? "<<verify>>"
          : kind.endsWith("requirement-derive-link") ? "<<deriveReqt>>"
            : kind.endsWith("requirement-refine-link") ? "<<refine>>"
              : kind.endsWith("requirement-trace-link") ? "<<trace>>"
                : kind.endsWith("allocation-relationship") ? "<<allocate>>"
                  : kind.endsWith("parametric-constraint") ? "="
                    : kind.endsWith("package-import") ? "<<import>>"
                      : kind.endsWith("package-merge") ? "<<merge>>"
                        : kind.endsWith("composite-part-connector") ? "connector"
                          : proposal.label;
    const hollowEnd = relationshipType === "dependency" || relationshipType === "sequence" || messageFlow || dataAssociation;
    const relationshipFields = proposalComponentFields(kind).map(field => planningDependency
      ? field.key === "relationship" ? { ...field, value: "FS" } : field.key === "lag" ? { ...field, value: "0" } : field
      : field);
    const relationship: ShapeElement = {
      type: "line", id: crypto.randomUUID(), componentRole: kind, relationshipType,
      x, y: y + height / 2, w: width, h: 0,
      color: proposal.section.startsWith("Systems") ? "#7563ad" : "#46525b", thickness: 1.8,
      lineStyle: dataAssociation ? "dotted" : dashed ? "dashed" : "solid", startHead: "none", endHead: noArrow ? "none" : planningDependency ? "solid" : hollowEnd ? "open" : "solid",
      lineRoute: "straight", label: { text: planningDependency ? "FS" : proposal.label, color: "#46525b", fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" },
      relationshipFields,
    };
    if (["proposal-systems-requirement-decomposition-link", "proposal-systems-requirement-satisfy-link", "proposal-systems-requirement-verify-link", "proposal-systems-requirement-derive-link", "proposal-systems-requirement-refine-link", "proposal-systems-requirement-trace-link", "proposal-systems-allocation-relationship", "proposal-systems-parametric-constraint", "proposal-systems-package-import", "proposal-systems-package-merge"].includes(kind)) relationship.label = { ...relationship.label!, text: stereotype };
    if (kind === "proposal-systems-composite-part-connector") relationship.label = { ...relationship.label!, text: "" };
    return relationship;
  }
  const relationships: Partial<Record<LibraryComponentKind, { color: string; lineStyle: ShapeElement["lineStyle"]; startHead: ShapeElement["startHead"]; endHead: ShapeElement["endHead"] }>> = {
    "uml-inheritance": { color: "#7563ad", lineStyle: "solid", startHead: "none", endHead: "hollow" },
    "uml-realization": { color: "#7563ad", lineStyle: "dashed", startHead: "none", endHead: "hollow" },
    "uml-aggregation": { color: "#7563ad", lineStyle: "solid", startHead: "open-diamond", endHead: "none" },
    "uml-composition": { color: "#7563ad", lineStyle: "solid", startHead: "diamond", endHead: "none" },
    "uml-association": { color: "#7563ad", lineStyle: "solid", startHead: "none", endHead: "none" },
    "uml-dependency": { color: "#7563ad", lineStyle: "dashed", startHead: "none", endHead: "open" },
    "uml-include": { color: "#7563ad", lineStyle: "dashed", startHead: "none", endHead: "open" },
    "uml-extend": { color: "#7563ad", lineStyle: "dashed", startHead: "none", endHead: "open" },
    "er-one-many": { color: "#000000", lineStyle: "solid", startHead: "bar", endHead: "crow" },
    "er-one-one": { color: "#000000", lineStyle: "solid", startHead: "bar", endHead: "bar" },
    "er-many-one": { color: "#000000", lineStyle: "solid", startHead: "crow", endHead: "bar" },
    "er-many-many": { color: "#000000", lineStyle: "solid", startHead: "crow", endHead: "crow" },
    "sequence-sync": { color: "#7563ad", lineStyle: "solid", startHead: "none", endHead: "solid" },
    "sequence-async": { color: "#7563ad", lineStyle: "solid", startHead: "none", endHead: "open" },
    "data-flow": { color: "#333333", lineStyle: "solid", startHead: "none", endHead: "solid" },
  };
  const style = relationships[kind]; if (!style) return undefined;
  const relationshipType: RelationshipType = kind === "uml-inheritance" ? "inheritance" : kind === "uml-aggregation" ? "aggregation" : kind === "uml-composition" ? "composition" : kind === "uml-association" ? "association" : kind === "uml-dependency" || kind === "uml-include" || kind === "uml-extend" ? "dependency" : kind.startsWith("er-") ? "association" : kind.startsWith("sequence-") ? "sequence" : "data-flow";
  const line: ShapeElement = {
    type: "line", id: crypto.randomUUID(), componentRole: kind, relationshipType, x, y: y + height / 2, w: width, h: 0, thickness: 1.8, lineRoute: "straight", straightOnly: true,
    color: style.color, lineStyle: style.lineStyle, startHead: style.startHead, endHead: style.endHead,
  };
  if (kind === "sequence-sync" || kind === "sequence-async") line.label = { text: kind === "sequence-sync" ? "Sync message" : "Async message", color: style.color, fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" };
  if (kind === "uml-include" || kind === "uml-extend") line.label = { text: kind === "uml-include" ? "<<include>>" : "<<extend>>", color: style.color, fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" };
  if (kind === "data-flow") line.label = { text: "DATA FLOW", color: "#333333", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "left", listType: "none", verticalAlign: "top" };
  return line;
}

export function defaultLibraryUiComponent(kind: LibraryComponentKind) {
  return defaultUiComponentRecord(kind);
}

export function defaultLibraryChartData(kind: LibraryComponentKind): LibraryChartData | undefined {
  if (kind === "viz-bar" || kind === "viz-horizontal-bar") return { title: kind === "viz-horizontal-bar" ? "Top services" : "Quarterly sales", xAxisLabel: kind === "viz-horizontal-bar" ? "Requests" : "Month", yAxisLabel: kind === "viz-horizontal-bar" ? "Service" : "Units", labels: kind === "viz-horizontal-bar" ? ["API gateway", "Database", "Worker", "Cache"] : ["Jan", "Mar", "May", "Jul", "Sep"], values: kind === "viz-horizontal-bar" ? [92, 78, 54, 38] : [55, 80, 44, 70, 62] };
  if (kind === "viz-stacked-bar") return { title: "Usage by region", xAxisLabel: "Month", yAxisLabel: "Units", labels: ["Jan", "Feb", "Mar", "Apr"], values: [42, 56, 48, 65], series: [{ name: "North", values: [42, 56, 48, 65] }, { name: "Central", values: [30, 36, 42, 39] }, { name: "South", values: [18, 24, 31, 35] }], options: { legend: "bottom", showGrid: true, showValues: false } };
  if (kind === "viz-line" || kind === "viz-area") return { title: kind === "viz-area" ? "Monthly signups" : "Monthly trend", xAxisLabel: "Month", yAxisLabel: "Users", labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], values: [28, 48, 38, 77, 67, 88] };
  if (kind === "viz-scatter") return { title: "Response time", xAxisLabel: "Request", yAxisLabel: "Milliseconds", labels: ["1", "2", "3", "4", "5", "6", "7", "8", "9"], values: [72, 42, 81, 53, 68, 30, 57, 40, 66] };
  if (kind === "viz-pie" || kind === "viz-donut") return { title: "Device mix", labels: ["Desktop", "Tablet", "Phone"], values: [46, 35, 19] };
  if (kind === "viz-radar") return { title: "Service profile", labels: ["Latency", "Reliability", "Cost", "Security", "Scale"], values: [72, 84, 65, 91, 76], series: [{ name: "Current", values: [72, 84, 65, 91, 76] }, { name: "Target", values: [82, 90, 74, 95, 88] }], options: { legend: "bottom", showGrid: true } };
  if (kind === "viz-gauge") return { title: "Capacity used", labels: ["Used"], values: [72], options: { maxValue: 100, showValues: true } };
  if (kind === "viz-funnel") return { title: "Request conversion", labels: ["Visits", "Qualified", "Trial", "Active"], values: [960, 620, 310, 184], options: { legend: "hidden", showValues: true } };
  if (kind === "viz-heatmap") return { title: "Weekly activity", xAxisLabel: "Day", yAxisLabel: "Team", labels: ["Mon", "Tue", "Wed", "Thu", "Fri"], values: [2, 5, 3, 6, 4], series: [{ name: "Platform", values: [2, 5, 3, 6, 4] }, { name: "Product", values: [4, 3, 7, 5, 6] }, { name: "Data", values: [1, 2, 4, 3, 5] }], options: { legend: "hidden", showValues: false, palette: "ocean" } };
  if (kind === "viz-treemap") return { title: "Resource share", labels: ["Compute", "Storage", "Database", "Network", "Other"], values: [34, 22, 19, 14, 11], options: { legend: "hidden", showValues: true } };
  if (kind === "viz-kpi") return { title: "Active users", labels: ["Active users", "Monthly change"], values: [24800, 12.6] };
  return undefined;
}

const cleanUmlKinds = new Set<LibraryComponentKind>(["uml-state", "uml-initial-state", "uml-final-state", "uml-fork", "uml-join", "uml-component", "uml-node", "uml-artifact", "uml-enumeration", "uml-object", "uml-activity-action", "uml-activity-decision", "uml-activity-initial", "uml-activity-final"]);
export const usesCleanModelRenderer = (kind: LibraryComponentKind) => kind.startsWith("diagram-") || kind.startsWith("software-") || kind.startsWith("db-") || kind.startsWith("c4-") || kind.startsWith("bpmn-") || kind.startsWith("network-") && kind !== "network-access-point" || kind.startsWith("cloud-") || kind.startsWith("proposal-") || !!cloudProviderComponent(kind) || kind === "tech-service" || kind === "data-flow" || cleanUmlKinds.has(kind);

const componentFields = (...fields: [key: string, label: string, hint: string][]): LibraryComponentFieldValue[] => fields.map(([key, label, hint]) => ({ key, label, hint, value: "" }));

/** Editable information is defined for the object that owns it; there is no shared modeling form. */
const MODEL_COMPONENT_FIELDS: Partial<Record<LibraryComponentKind, LibraryComponentFieldValue[]>> = {
  "uml-class": componentFields(["attributes", "Attributes", "One UML property per line, e.g. - id: UUID"], ["methods", "Operations", "One operation per line, e.g. + save(): void"]),
  "uml-object": componentFields(["classifier", "Classifier", "Class or type instantiated, e.g. Order"], ["state", "State", "State represented by this snapshot"], ["slots", "Slot values", "One attribute = value per line, e.g. status = pending"]),
  "uml-interface": componentFields(["operations", "Operations", "One operation signature per line, e.g. getOrder(id): Order"]),
  "uml-enumeration": componentFields(["literals", "Literals", "One enum value per line, e.g. pending"]),
  "uml-state": componentFields(["entry", "Entry behavior", "Behavior run when this state becomes active"], ["do", "Do activity", "Activity performed while this state is active"], ["exit", "Exit behavior", "Behavior run when this state is left"]),
  "uml-activity-action": componentFields(["behavior", "Behavior", "Operation or work performed by this action"], ["inputs", "Input pins", "Values or objects consumed, one per line"], ["outputs", "Output pins", "Values or objects produced, one per line"]),
  "uml-activity-decision": componentFields(["condition", "Decision condition", "Boolean expression evaluated by this node"], ["guards", "Outgoing guards", "One guard per outgoing flow, e.g. [approved]"]),
  "uml-actor": componentFields(["role", "Role", "Person or external system represented by this actor"], ["goal", "Goal", "Outcome this actor wants from the system"]),
  "uml-use-case": componentFields(["preconditions", "Preconditions", "Conditions that must hold before this use case"], ["main-flow", "Main flow", "One user/system step per line"], ["outcome", "Postcondition", "State reached after success or failure"]),
  "uml-package": componentFields(["namespace", "Namespace", "Package or module path"], ["contents", "Contained classifiers", "Types or packages owned by this package"]),
  "uml-component": componentFields(["provided", "Provided interfaces", "Interfaces this component realizes"], ["required", "Required interfaces", "Interfaces this component depends on"], ["artifact", "Implementation artifact", "Module, binary, or deployable that implements it"]),
  "uml-node": componentFields(["execution-environment", "Execution environment", "Runtime or hardware, e.g. Kubernetes node pool"], ["deployed-artifacts", "Deployed artifacts", "Artifact names and versions deployed here"], ["location", "Deployment location", "Region, cluster, or data center"]),
  "uml-artifact": componentFields(["artifact-type", "Artifact type", "Executable, library, configuration, schema, or document"], ["version", "Version", "Artifact version or release"], ["repository", "Repository", "Image, package, or source repository reference"]),
  "er-table": [1, 2, 3].map(index => ({ key: `column-${index}`, label: `Column ${index}`, hint: "name: data_type [PK, FK, NULL]", value: "" })),
  "er-entity": componentFields(["identifier", "Primary identifier", "Key attribute(s), e.g. customer_id"], ["attributes", "Attributes", "One attribute and type per line"], ["unique-rules", "Unique constraints", "Candidate keys or other uniqueness rules"]),
  "er-weak-entity": componentFields(["owner", "Owner entity", "Strong entity that identifies this entity"], ["partial-key", "Discriminator", "Attribute that distinguishes instances under one owner"], ["attributes", "Non-key attributes", "One attribute and type per line"]),
  "er-associative-entity": componentFields(["first-entity", "First participating entity", "Entity at one end of the association"], ["second-entity", "Second participating entity", "Entity at the other end"], ["association-key", "Association key", "Composite or surrogate key for this association"], ["attributes", "Association attributes", "Attributes that belong to the relationship"]),
  "er-relationship": componentFields(["source-role", "Source role", "Role name for the first entity"], ["target-role", "Target role", "Role name for the second entity"], ["constraint", "Relationship constraint", "Optional rule governing the relationship"]),
  "er-identifying-relationship": componentFields(["owner-role", "Owner role", "Role played by the identifying entity"], ["dependent-role", "Dependent role", "Role played by the weak entity"], ["identification-rule", "Identification rule", "How the owner key identifies the dependent entity"]),
  "er-attribute": componentFields(["data-type", "Data type", "SQL or domain type, e.g. VARCHAR(120)"], ["optional", "Optionality", "Required or optional; include domain constraints"]),
  "er-key-attribute": componentFields(["data-type", "Data type", "Type of the primary key attribute"], ["generation", "Key generation", "Natural, sequence, UUID, or generated expression"]),
  "er-partial-key-attribute": componentFields(["data-type", "Data type", "Type of the discriminator"], ["scope", "Uniqueness scope", "Owner key this partial key is unique within"]),
  "er-multivalued-attribute": componentFields(["element-type", "Element type", "Type of each value in this collection"], ["multiplicity", "Multiplicity", "Minimum/maximum values or collection rule"]),
  "er-derived-attribute": componentFields(["expression", "Derivation expression", "Formula or source attributes used to derive this value"], ["refresh", "Calculation timing", "Computed on read, stored, or refreshed on a schedule"]),
  "er-composite-attribute": [
    { key: "sub-attribute-1", label: "First component", hint: "First part of this composite value", value: "Attribute 1" },
    { key: "sub-attribute-2", label: "Second component", hint: "Second part of this composite value", value: "Attribute 2" },
  ],
  "software-api": componentFields(["method", "HTTP method", "GET, POST, PUT, PATCH, DELETE, or another method"], ["path", "Path template", "e.g. /orders/{orderId}"], ["summary", "Operation summary", "What this operation does"], ["request-body", "Request body", "Media type and schema, e.g. application/json: CreateOrder"], ["responses", "Responses", "Status code and response schema per line, e.g. 200: Order"], ["parameters", "Parameters", "One name, location, type, and required flag per line"], ["security", "Security requirements", "Scheme and scopes, or explicitly write none"], ["server", "Server", "Base URL or service receiving this request"], ["operation-id", "Operation ID", "Stable identifier used by clients, e.g. getOrderById"]),
  "software-client": componentFields(["platform", "Client platform", "Browser, iOS, Android, desktop, or CLI"], ["entry-route", "Entry route", "URL, app screen, or command that starts this workflow"], ["audience", "Audience", "User group or external system"], ["session-model", "Session model", "Cookie, token, device identity, or no session"]),
  "software-service": componentFields(["responsibility", "Owned responsibility", "Business capability or domain this service owns"], ["interfaces", "Provided interfaces", "API, RPC, events, or scheduled jobs"], ["runtime", "Runtime", "Language, framework, or execution platform"], ["data-ownership", "Data ownership", "Data this service may write"]),
  "tech-service": componentFields(["technology", "Technology", "Product or technology name and version"], ["deployment-unit", "Deployment unit", "Package, process, or managed service"], ["purpose", "Technical purpose", "What role this technology performs here"]),
  "software-database": componentFields(["engine", "Database engine", "Engine and version, e.g. PostgreSQL 16"], ["schema", "Schema / collections", "Important tables, collections, or key patterns"], ["consistency", "Consistency model", "Transactional, eventual, or per-record behavior"], ["recovery", "Backup and recovery", "Backup frequency and recovery target"]),
  "db-view": componentFields(["query", "Query / projection", "SQL query or selected columns and expressions"], ["sources", "Source tables", "Tables or views read by this view"], ["refresh", "Refresh behavior", "Virtual, materialized, refresh schedule, or trigger"]),
  "db-index": componentFields(["columns", "Indexed columns", "Ordered columns or expressions, one per line"], ["method", "Index method", "B-tree, hash, GIN, GiST, or engine-specific method"], ["uniqueness", "Uniqueness", "Unique, primary, or non-unique"], ["predicate", "Predicate / included columns", "Partial-index condition or included columns"]),
  "db-procedure": componentFields(["signature", "Signature", "Routine name and parameter types"], ["parameters", "Parameters", "One parameter and direction per line"], ["transaction", "Transaction behavior", "Own transaction, caller transaction, or autonomous"], ["effects", "Side effects", "Tables written, messages emitted, or external calls"]),
  "software-queue": componentFields(["queue-name", "Queue / topic", "Actual queue, topic, or subscription name"], ["message-shape", "Message contract", "Event or command type and schema"], ["ordering", "Ordering", "Partition key or FIFO ordering rule"], ["failure-policy", "Failure handling", "Retries, visibility timeout, and dead-letter destination"]),
  "software-event-bus": componentFields(["event-types", "Routed event types", "Event names or routing patterns"], ["routing", "Routing rule", "How events are matched to subscribers"], ["delivery-guarantee", "Delivery guarantee", "Ordering, retries, and duplicate handling"]),
  "software-cache": componentFields(["cached-values", "Cached values", "Key pattern and value being cached"], ["expiration", "Expiration", "TTL or invalidation rule"], ["eviction", "Eviction policy", "LRU, LFU, size bound, or no eviction"]),
  "cloud-boundary": componentFields(["account", "Account / subscription", "Cloud account or subscription identifier"], ["region", "Region", "Regions included inside this boundary"], ["network-scope", "Network scope", "VPC, VNet, or project boundary"], ["policy-boundary", "Policy boundary", "Identity or organization policy applied here"]),
  "cloud-function": componentFields(["handler", "Handler", "Function name or entry-point symbol"], ["runtime", "Runtime", "Runtime and version, e.g. Node.js 22"], ["invocation", "Invocation source", "HTTP route, schedule, queue, or event rule"], ["timeout-memory", "Timeout / memory", "Configured execution timeout and memory"], ["identity", "Execution identity", "Role or service account used by the function"]),
  "cloud-storage": componentFields(["bucket", "Bucket name", "Storage bucket or container identifier"], ["stored-objects", "Stored objects", "Object prefixes, file types, or data purpose"], ["access-policy", "Access policy", "Private/public access, encryption, and principal"], ["retention", "Retention / lifecycle", "Versioning, expiration, or retention policy"]),
  "cloud-database": componentFields(["engine", "Database engine", "Engine and version"], ["database-name", "Database / cluster", "Database, cluster, or collection identifier"], ["network", "Network placement", "Subnet group, private endpoint, or allowed clients"], ["availability", "Availability and backup", "Replica, backup, and recovery setup"]),
  "cloud-queue": componentFields(["queue-address", "Queue address", "Queue, topic, or subscription identifier"], ["message-type", "Message type", "Payload or event contract"], ["retention-redrive", "Retention / redrive", "Message retention, retry, and dead-letter setup"]),
  "network-zone": componentFields(["trust-level", "Trust level", "Public, DMZ, internal, restricted, or custom"], ["ingress-policy", "Ingress policy", "Traffic allowed into this zone"], ["egress-policy", "Egress policy", "Traffic allowed out of this zone"]),
  "network-subnet": componentFields(["cidr", "IPv4 / IPv6 CIDR", "e.g. 10.20.0.0/24"], ["gateway", "Default gateway", "Gateway address for this subnet"], ["vlan", "VLAN / segment ID", "VLAN tag or cloud subnet identifier"], ["address-allocation", "Address allocation", "DHCP range, reserved addresses, or static policy"]),
  "network-router": componentFields(["management-address", "Management address", "Router management IP or hostname"], ["routing-protocol", "Routing protocol", "Static, OSPF, BGP, or another protocol"], ["routes", "Routes", "Destination prefix → next hop per line"], ["autonomous-system", "BGP AS number", "Local autonomous system number, if applicable"]),
  "network-switch": componentFields(["management-address", "Management address", "Switch management IP or hostname"], ["vlans", "VLANs", "VLAN ID and name per line"], ["uplinks", "Uplinks", "Trunk ports or upstream switch ports"], ["port-map", "Port assignments", "Port → device or network per line"]),
  "network-hub": componentFields(["segment", "Shared segment", "Ethernet segment connected by this repeater"], ["connected-devices", "Connected devices", "Device names or port groups"]),
  "network-firewall": componentFields(["zones", "Traffic zones", "Source zone → destination zone"], ["rules", "Firewall rules", "One allow/deny rule with protocol, port, and endpoints per line"], ["default-action", "Default action", "What happens when no rule matches"], ["inspection", "Inspection", "Stateful, deep packet inspection, or filtering mode"]),
  "network-load-balancer": componentFields(["virtual-address", "Virtual address", "VIP or service DNS name"], ["listeners", "Listeners", "Protocol and port, e.g. HTTPS :443"], ["target-pool", "Target pool", "Backend instances or service name"], ["health-probe", "Health probe", "Protocol, port, path, and interval"]),
  "network-server": componentFields(["hostname", "Hostname", "DNS hostname or node name"], ["ip-addresses", "IP addresses", "Interface name and IPv4/IPv6 address"], ["operating-system", "Operating system", "Distribution and version"], ["services", "Listening services", "Service and port per line"]),
  "network-workstation": componentFields(["hostname", "Hostname", "Workstation DNS name"], ["user", "Assigned user", "Primary user or team"], ["address", "Network address", "IP address or DHCP scope"], ["platform", "Platform", "Operating system and device type"]),
  "network-printer": componentFields(["queue-name", "Print queue", "Queue name exposed to users"], ["address", "Printer address", "IP address or print server queue"], ["model", "Printer model", "Manufacturer and model"], ["access", "Access", "Users, sites, or network that may print"]),
  "network-client": componentFields(["device", "Client device", "Device type or hostname"], ["network", "Connected network", "SSID, VLAN, or subnet"], ["identity", "Client identity", "User, device certificate, or account"]),
  "network-access-point": componentFields(["ssid", "SSID", "Wireless network name"], ["security-mode", "Security mode", "WPA2/WPA3, enterprise, or open"], ["channel", "Radio channel", "Band and channel assignment"], ["coverage", "Coverage area", "Floor, room, or access-point group"]),
  "network-internet": componentFields(["provider", "Upstream provider", "ISP or external network"], ["public-prefix", "Public prefix", "Advertised IPv4/IPv6 range"], ["handoff", "Handoff", "Transit, peering, or circuit identifier"]),
  "network-vpn": componentFields(["vpn-type", "VPN type", "Site-to-site, remote access, or mesh"], ["local-prefixes", "Local networks", "Local CIDR ranges behind this endpoint"], ["remote-prefixes", "Remote networks", "Peer CIDR ranges"], ["peer", "Peer endpoint", "Peer public IP or hostname"], ["authentication", "Authentication", "Certificate, pre-shared key name, or identity provider"]),
  "network-dns": componentFields(["zone", "DNS zone", "Authoritative zone name"], ["records", "Important records", "Name, type, and target per line"], ["resolver", "Resolver", "Authoritative, recursive, or forwarding resolver"]),
  "network-proxy": componentFields(["proxy-mode", "Proxy mode", "Forward, reverse, transparent, or service mesh"], ["upstream", "Upstream target", "Destination service or proxy"], ["rules", "Routing rules", "Host/path → upstream mapping"], ["tls", "TLS handling", "Pass-through, termination, or re-encryption"]),
  "network-bridge": componentFields(["segments", "Connected segments", "Network segments joined by this bridge"], ["forwarding-policy", "Forwarding policy", "Learning, filtering, or spanning-tree behavior"]),
  "network-bastion": componentFields(["public-address", "Public entry address", "Public IP or DNS entry point"], ["allowed-sources", "Allowed source ranges", "CIDRs permitted to connect"], ["access-method", "Access method", "SSH, RDP, identity-aware proxy, or session manager"], ["target-scope", "Reachable targets", "Private hosts this bastion may access"]),
  "network-gateway": componentFields(["gateway-type", "Gateway type", "Protocol or network boundary bridged"], ["inside-interface", "Inside interface", "Address or network on the internal side"], ["outside-interface", "Outside interface", "Address or network on the external side"], ["translation", "Translation / routing", "Route, protocol conversion, or translation rule"]),
  "network-nat-gateway": componentFields(["nat-mode", "NAT mode", "Source NAT, destination NAT, or both"], ["private-subnets", "Private subnets", "CIDRs using this gateway"], ["public-address", "Public address", "Egress IP or address pool"], ["port-mapping", "Port mappings", "Private endpoint → public port mapping"]),
  "network-modem": componentFields(["access-technology", "Access technology", "Cable, DSL, fiber ONT, cellular, or satellite"], ["line-id", "Circuit / line ID", "Provider circuit identifier"], ["handoff-address", "WAN handoff", "Upstream address or bridge mode details"]),
  "c4-person": componentFields(["role", "Role", "User role or external actor"], ["goal", "Goals", "Capabilities this person needs from the system"], ["frequency", "Interaction frequency", "How often or when this person uses it"]),
  "c4-software-system": componentFields(["description", "Capability", "What the system does for its users"], ["owner", "Owning team", "Team or organization responsible for it"], ["technology", "Key technology", "Primary platform or technology, if relevant"]),
  "c4-external-system": componentFields(["description", "External capability", "What the external system provides"], ["interface", "Integration interface", "Protocol or API used to integrate"], ["data-exchanged", "Data exchanged", "Information sent to or received from it"]),
  "c4-container": componentFields(["description", "Responsibility", "What this application or data store does"], ["technology", "Technology", "Runtime, framework, or data technology"], ["interface", "Interface", "HTTP API, SQL, messaging, or other interface"]),
  "c4-component": componentFields(["description", "Responsibility", "What this component does inside its container"], ["technology", "Implementation", "Module, class, package, or technology"], ["interface", "Key interface", "Provided or required API / interface"]),
  "c4-container-instance": componentFields(["responsibility", "Responsibility", "Application or data store responsibility"], ["technology", "Technology", "Runtime, framework, or data technology"], ["interfaces", "Interfaces", "HTTP API, SQL, messaging, or other interfaces"]),
  "c4-component-instance": componentFields(["responsibility", "Responsibility", "Module responsibility within its parent container"], ["implementation", "Implementation", "Module, class, package, or technology"], ["interface", "Interface", "Provided or required API / interface"]),
  "c4-system": componentFields(["system-scope", "System scope", "Systems included in this boundary"], ["context", "Boundary context", "Deployment or organizational context shown"]),
  "c4-deployment-node": componentFields(["environment", "Environment", "Development, staging, production, or region"], ["instance", "Node instance", "Host, VM, pod, or runtime instance"], ["technology", "Runtime technology", "Operating system, cloud service, or orchestration platform"]),
  "c4-infrastructure-node": componentFields(["infrastructure-role", "Infrastructure role", "Load balancer, DNS, storage, network, or other role"], ["technology", "Technology", "Product or managed infrastructure service"], ["location", "Location", "Zone, region, or network"]),
  "c4-code-element": componentFields(["signature", "Signature", "Class, function, interface, or table signature"], ["responsibility", "Responsibility", "Behavior implemented by this code element"], ["source-location", "Source location", "Package, module, or source path"]),
  "bpmn-task": componentFields(["activity", "Activity", "Work performed by this task"], ["input", "Input", "Data or condition needed to begin"], ["result", "Result", "Output or state change produced"]),
  "bpmn-user-task": componentFields(["assignee", "Assignee", "User, group, or candidate role"], ["form", "User form", "Form or screen used to complete the task"], ["completion-condition", "Completion condition", "Rule required to complete or approve"]),
  "bpmn-service-task": componentFields(["operation", "Service operation", "API, job, or worker operation invoked"], ["implementation", "Implementation", "Service task implementation or connector"], ["input-mapping", "Input mapping", "Process variables mapped to the operation"], ["result-mapping", "Result mapping", "Operation result mapped back to process data"]),
  "bpmn-script-task": componentFields(["script-language", "Script language", "Language or expression type"], ["script", "Script", "Script body or script resource name"], ["variables", "Variables", "Process variables read or written"]),
  "bpmn-manual-task": componentFields(["instruction", "Work instruction", "Action performed outside the workflow system"], ["performer", "Performer", "Role or team performing the work"], ["evidence", "Completion evidence", "Record, confirmation, or artifact produced"]),
  "bpmn-business-rule-task": componentFields(["decision", "Decision", "Business decision evaluated"], ["decision-table", "Decision table", "DMN decision or rule table name"], ["outputs", "Decision outputs", "Variables or values returned to the process"]),
  "bpmn-send-task": componentFields(["message", "Message sent", "Message name and payload"], ["recipient", "Recipient", "Participant, endpoint, or queue receiving the message"], ["correlation", "Correlation", "Correlation key used to match the exchange"]),
  "bpmn-receive-task": componentFields(["message", "Message received", "Expected message name and payload"], ["sender", "Expected sender", "Participant, endpoint, or queue"], ["correlation", "Correlation", "Correlation key used to match the exchange"]),
  "bpmn-call-activity": componentFields(["called-process", "Called process", "Process or global task invoked"], ["input-mapping", "Input mapping", "Variables passed into the called process"], ["output-mapping", "Output mapping", "Called process results returned to this process"]),
  "bpmn-subprocess": componentFields(["purpose", "Subprocess purpose", "Work grouped inside this subprocess"], ["entry-condition", "Entry condition", "Condition for starting the contained flow"], ["completion-condition", "Completion condition", "Condition for completing the subprocess"]),
  "bpmn-start": componentFields(["trigger", "Start trigger", "None, message, timer, signal, or conditional"], ["trigger-reference", "Trigger reference", "Message, schedule, or condition name"]),
  "bpmn-message-event": componentFields(["message-name", "Message", "Message definition or event name"], ["direction", "Event direction", "Catch incoming or throw outgoing"], ["correlation", "Correlation", "Key that identifies the process instance"]),
  "bpmn-timer-event": componentFields(["timer-kind", "Timer kind", "Date, duration, or cycle"], ["timer-expression", "Timer expression", "ISO date, ISO duration, or repeat cycle"]),
  "bpmn-error-event": componentFields(["error-code", "Error code", "Error definition code"], ["error-name", "Error name", "Expected or thrown error"], ["catching-scope", "Handled by", "Activity or boundary that catches this error"]),
  "bpmn-signal-event": componentFields(["signal", "Signal", "Signal definition name"], ["direction", "Event direction", "Broadcast signal or wait for signal"], ["scope", "Signal scope", "Process or event scope"]),
  "bpmn-event": componentFields(["event-kind", "Event kind", "Message, timer, signal, escalation, or conditional"], ["event-definition", "Event definition", "Definition name or expression"]),
  "bpmn-boundary-event": componentFields(["attached-activity", "Attached activity", "Task or subprocess this event is attached to"], ["event-definition", "Event definition", "Timer, error, message, escalation, or signal"], ["interrupting", "Interrupting", "Whether the event cancels its attached activity"]),
  "bpmn-end": componentFields(["outcome", "Process outcome", "Business result when this path ends"]),
  "bpmn-terminate-event": componentFields(["termination-scope", "Termination scope", "Process instance or subprocess terminated"], ["reason", "Termination reason", "Why this event ends the active scope"]),
  "bpmn-data": componentFields(["data-object", "Data object", "Business document or data record"], ["state", "Data state", "Created, pending, approved, rejected, or another state"], ["format", "Data format", "Schema, document format, or data contract"]),
  "bpmn-data-store": componentFields(["store", "Data store", "Repository or durable storage represented"], ["retention", "Retention", "How long the process data is retained"], ["system-of-record", "System of record", "Authoritative service or repository"]),
  "bpmn-text-annotation": componentFields(["annotation", "Annotation", "Clarification, policy, or exception text"]),
  "bpmn-group": componentFields(["purpose", "Group purpose", "Why these flow objects are grouped together"]),
  "bpmn-pool": componentFields(["participant", "Participant", "Organization, role, or system responsible for this process"], ["process-reference", "Process reference", "Process name or collaboration participant ID"]),
  "data-flow": componentFields(["payload", "Payload", "Data carried by this flow"], ["transport", "Transport", "Protocol, topic, file, or channel"], ["frequency", "Transfer frequency", "Continuous, scheduled, or event-triggered"]),
  "diagram-legend": componentFields(["legend-items", "Legend entries", "One symbol or color meaning per line"]),
};

// Provider entries are explicit because each cloud resource has its own useful configuration.
Object.assign(MODEL_COMPONENT_FIELDS, {
  "aws-ec2": componentFields(["instance-type", "Instance type", "e.g. t3.large"], ["image", "AMI / image", "Image ID or operating system"], ["placement", "Placement", "Availability zone and subnet"], ["security-groups", "Security groups", "Attached security group names"]),
  "aws-lambda": componentFields(["runtime", "Runtime", "Node.js, Python, Java, or custom runtime"], ["handler", "Handler", "Module and function entry point"], ["trigger", "Trigger", "API, queue, schedule, or event rule"], ["execution-role", "Execution role", "IAM role used at runtime"]),
  "aws-s3": componentFields(["bucket-name", "Bucket name", "Globally unique bucket name"], ["prefixes", "Object prefixes", "Important object key prefixes or content"], ["encryption", "Encryption", "SSE-S3, SSE-KMS, or customer key"], ["lifecycle", "Lifecycle", "Versioning, expiration, or archival rule"]),
  "aws-rds": componentFields(["engine", "Engine", "PostgreSQL, MySQL, MariaDB, Oracle, or SQL Server"], ["instance-class", "Instance class", "DB instance class"], ["database", "Initial database", "Database name or cluster identifier"], ["multi-az-backup", "Availability / backup", "Multi-AZ, backup window, and retention"]),
  "aws-api-gateway": componentFields(["api-type", "API type", "HTTP, REST, or WebSocket"], ["route", "Route", "Method and route path"], ["integration", "Integration", "Lambda, HTTP backend, or service integration"], ["authorization", "Authorization", "JWT authorizer, IAM, Cognito, or none"]),
  "aws-sqs": componentFields(["queue-url", "Queue URL / name", "Queue identifier"], ["queue-mode", "Queue mode", "Standard or FIFO"], ["visibility-timeout", "Visibility timeout", "Seconds a received message stays hidden"], ["dead-letter", "Dead-letter queue", "DLQ name and max receive count"]),
  "aws-vpc": componentFields(["cidr", "VPC CIDR", "Primary IPv4/IPv6 range"], ["subnets", "Subnets", "Subnet CIDRs and availability zones"], ["routing", "Route tables", "Important route-table associations"], ["endpoints", "Endpoints", "Internet, NAT, or VPC endpoints"]),
  "aws-cloudfront": componentFields(["distribution-domain", "Distribution domain", "CloudFront domain or alias"], ["origin", "Origin", "S3 bucket, load balancer, or custom origin"], ["behaviors", "Cache behaviors", "Path pattern and origin per line"], ["protection", "Protection", "WAF, signed URLs, and TLS policy"]),
  "aws-ecs": componentFields(["cluster", "Cluster", "ECS cluster name"], ["service-task", "Service / task", "Service name and task definition"], ["launch-type", "Launch type", "Fargate or EC2 capacity provider"], ["network", "Network", "Subnets and security groups"]),
  "aws-eks": componentFields(["cluster", "Cluster", "EKS cluster name and version"], ["node-groups", "Node groups", "Managed or self-managed node groups"], ["network", "Network", "VPC and subnet placement"], ["access", "Cluster access", "IAM roles and endpoint exposure"]),
  "aws-dynamodb": componentFields(["table", "Table name", "DynamoDB table identifier"], ["keys", "Primary key", "Partition and sort key attributes"], ["indexes", "Secondary indexes", "GSI / LSI names and keys"], ["capacity", "Capacity mode", "On-demand or provisioned read/write capacity"]),
  "aws-sns": componentFields(["topic", "Topic name / ARN", "SNS topic identifier"], ["subscribers", "Subscriptions", "Queue, function, HTTPS, or email subscribers"], ["filter-policy", "Filter policy", "Message attributes used for filtering"], ["delivery", "Delivery policy", "Retry or raw-message delivery settings"]),
  "aws-eventbridge": componentFields(["bus", "Event bus", "Bus name"], ["event-pattern", "Event pattern", "Source and detail-type match"], ["targets", "Targets", "Rules and target services"], ["archive-replay", "Archive / replay", "Retention and replay policy"]),
  "aws-cloudwatch": componentFields(["namespace", "Namespace", "Metric namespace or log group"], ["signals", "Signals", "Metrics, log filters, or traces monitored"], ["alarm", "Alarm condition", "Threshold, period, and evaluation count"], ["notification", "Notification", "SNS topic or incident destination"]),
  "aws-secrets-manager": componentFields(["secret-name", "Secret name", "Secret identifier or path"], ["secret-purpose", "Secret purpose", "Credentials or key stored; never enter the secret value"], ["rotation", "Rotation", "Rotation schedule and rotation function"], ["access-policy", "Access policy", "IAM principals allowed to retrieve it"]),
  "aws-iam": componentFields(["principal", "Principal", "User, role, or federated identity"], ["policy", "Policy", "Policy name or managed policy ARN"], ["actions-resources", "Permissions", "Actions and resources granted"], ["trust", "Trust relationship", "Principals permitted to assume this role"]),
  "azure-vm": componentFields(["vm-size", "VM size", "Azure size, e.g. Standard_D4s_v5"], ["image", "Image", "Marketplace image or custom image"], ["availability", "Availability", "Zone, set, or scale set"], ["network", "Network interface", "VNet, subnet, and security group"]),
  "azure-functions": componentFields(["runtime", "Runtime stack", "Functions runtime and language version"], ["trigger", "Trigger binding", "HTTP, timer, queue, or event trigger"], ["hosting-plan", "Hosting plan", "Consumption, Flex, Premium, or Dedicated"], ["identity", "Managed identity", "Identity and resource permissions"]),
  "azure-blob-storage": componentFields(["account-container", "Account / container", "Storage account and container names"], ["blob-content", "Blob content", "Object prefixes or file types"], ["redundancy", "Redundancy", "LRS, ZRS, GRS, or RA-GRS"], ["access-tier", "Access tier", "Hot, cool, cold, or archive"]),
  "azure-sql": componentFields(["server-database", "Server / database", "Logical server and database name"], ["service-tier", "Service tier", "General Purpose, Business Critical, or Hyperscale"], ["compute", "Compute size", "vCore, DTU, or serverless configuration"], ["network-security", "Network access", "Private endpoint, firewall, and authentication"]),
  "azure-api-management": componentFields(["api-name", "API", "Published API name and version"], ["operation", "Operation", "Method and URL template"], ["backend", "Backend", "Service URL or named backend"], ["policy", "Policy", "JWT, rate-limit, transform, or cache policy"]),
  "azure-service-bus": componentFields(["namespace-entity", "Namespace / entity", "Namespace plus queue or topic name"], ["entity-type", "Entity type", "Queue, topic, or subscription"], ["sessions-ttl", "Sessions / TTL", "Session use and message time-to-live"], ["dead-letter", "Dead-letter handling", "Retry, max delivery, and DLQ policy"]),
  "azure-vnet": componentFields(["address-space", "Address space", "VNet CIDR ranges"], ["subnets", "Subnets", "Subnet names and CIDRs"], ["peerings", "Peerings", "Connected VNet or gateway"], ["security", "Security", "NSGs, route tables, and private DNS"]),
  "azure-app-service": componentFields(["app-name-host", "App / hostname", "App name and custom hostname"], ["runtime-stack", "Runtime stack", "Language and version"], ["plan-scale", "Plan / scale", "App Service plan, instances, and autoscale"], ["deployment-slot", "Deployment slots", "Production and staging slot arrangement"]),
  "azure-aks": componentFields(["cluster-version", "Cluster version", "AKS Kubernetes version"], ["node-pools", "Node pools", "Pool names, VM sizes, and counts"], ["network-plugin", "Network", "Azure CNI / kubenet and address ranges"], ["identity-registry", "Identity / registry", "Managed identity and container registry"]),
  "azure-cosmos-db": componentFields(["api-database", "API / database", "Core (SQL), MongoDB, Cassandra, Gremlin, or Table"], ["containers-keys", "Containers / partition keys", "Container names and partition key paths"], ["consistency", "Consistency", "Strong, bounded staleness, session, consistent prefix, or eventual"], ["regions-throughput", "Regions / throughput", "Write/read regions and RU/s"]),
  "azure-key-vault": componentFields(["vault-name", "Vault name", "Key Vault identifier"], ["object-types", "Objects", "Key, secret, and certificate names; never enter secret values"], ["access-model", "Access model", "Azure RBAC or access policies"], ["networking", "Network access", "Private endpoint, firewall, and trusted services"]),
  "azure-event-hubs": componentFields(["namespace-hub", "Namespace / hub", "Event Hubs namespace and hub name"], ["partitions", "Partitions", "Partition count and partition key"], ["consumers", "Consumer groups", "Consumer group names"], ["retention-capture", "Retention / capture", "Retention duration and Capture destination"]),
  "azure-monitor": componentFields(["workspace", "Workspace", "Log Analytics workspace or Application Insights resource"], ["signals", "Signals", "Metrics, logs, traces, and resource scope"], ["alert-rule", "Alert rule", "Query or threshold and evaluation frequency"], ["action-group", "Action group", "Incident, email, webhook, or automation target"]),
  "azure-application-gateway": componentFields(["frontend", "Frontend", "Public/private frontend IP and listener"], ["listeners", "Listeners", "Protocol, port, hostname, and TLS certificate"], ["backend-pool", "Backend pool", "Pool members or service"], ["routing-waf", "Routing / WAF", "Path rules, probe, and WAF policy"]),
  "azure-storage-queue": componentFields(["queue-name", "Queue name", "Storage queue identifier"], ["message-purpose", "Message purpose", "Message type or consumer"], ["visibility-retention", "Visibility / retention", "Visibility timeout and message TTL"]),
  "azure-firewall": componentFields(["firewall-policy", "Firewall policy", "Policy and rule collection names"], ["network-rules", "Network rules", "Source, destination, protocol, and port"], ["application-rules", "Application rules", "FQDNs and allowed protocols"], ["snat-dnat", "NAT rules", "SNAT or DNAT mappings"]),
  "gcp-compute-engine": componentFields(["machine-type", "Machine type", "e.g. e2-standard-4"], ["image-disk", "Image / boot disk", "Image family and disk size/type"], ["zone-network", "Zone / network", "Zone, VPC, and subnet"], ["service-account", "Service account", "Attached identity and scopes"]),
  "gcp-cloud-functions": componentFields(["generation-runtime", "Generation / runtime", "Cloud Functions generation and runtime"], ["entry-point", "Entry point", "Function entry-point symbol"], ["trigger", "Trigger", "HTTP, Pub/Sub, storage, or event trigger"], ["identity-resources", "Identity / resources", "Service account, memory, and timeout"]),
  "gcp-cloud-storage": componentFields(["bucket", "Bucket name", "Globally unique bucket name"], ["location", "Location", "Region, dual-region, or multi-region"], ["storage-class", "Storage class", "Standard, Nearline, Coldline, or Archive"], ["access-protection", "Access / protection", "Uniform access, public access prevention, and encryption"]),
  "gcp-cloud-sql": componentFields(["engine-instance", "Engine / instance", "MySQL, PostgreSQL, or SQL Server and instance ID"], ["tier", "Machine tier", "vCPU and memory tier"], ["network", "Network", "Private IP, VPC, and authorized networks"], ["ha-backups", "HA / backups", "Regional HA, backup window, and PITR"]),
  "gcp-api-gateway": componentFields(["gateway-api", "Gateway / API", "Gateway and API config name"], ["routes", "Routes", "Method and path per line"], ["backend", "Backend", "Cloud Run, function, or service URL"], ["auth", "Authentication", "JWT issuer, audience, or IAM policy"]),
  "gcp-pubsub": componentFields(["topic", "Topic", "Pub/Sub topic name"], ["subscriptions", "Subscriptions", "Pull, push, or BigQuery subscriptions"], ["ordering", "Ordering", "Ordering key and exactly-once setting"], ["retention-dlq", "Retention / dead letter", "Message retention and dead-letter topic"]),
  "gcp-vpc": componentFields(["network-mode", "Network mode", "Custom or auto subnet mode"], ["subnets", "Subnets", "Subnet CIDRs and regions"], ["routes-peering", "Routes / peering", "Important routes and VPC peers"], ["shared-vpc", "Shared VPC", "Host project and service projects"]),
  "gcp-load-balancing": componentFields(["scheme", "Load balancer scheme", "External or internal; global or regional"], ["frontend", "Frontend", "IP address, forwarding rule, and protocol"], ["backend-service", "Backend service", "Backend group and balancing mode"], ["url-map", "URL map / health check", "Host/path routing and probe"]),
  "gcp-gke": componentFields(["cluster-version", "Cluster version", "Kubernetes version and release channel"], ["cluster-mode", "Cluster mode", "Autopilot or Standard"], ["node-pools", "Node pools", "Machine types and autoscaling range"], ["network", "Network", "VPC-native ranges and private endpoint"]),
  "gcp-cloud-run": componentFields(["service-image", "Service / image", "Cloud Run service and container image"], ["region", "Region", "Deployment region"], ["ingress-scale", "Ingress / scale", "Ingress policy and min/max instances"], ["service-identity", "Service identity", "Runtime service account and invoker policy"]),
  "gcp-firestore": componentFields(["database-mode", "Database mode", "Native or Datastore mode"], ["location", "Location", "Region or multi-region"], ["collections", "Collections", "Collection names and document purpose"], ["indexes-rules", "Indexes / rules", "Composite indexes and security rules"]),
  "gcp-spanner": componentFields(["instance-database", "Instance / database", "Instance and database names"], ["configuration", "Instance configuration", "Regional or multi-region configuration"], ["schema", "Schema", "Important tables and primary keys"], ["compute-backup", "Compute / backup", "Processing units or nodes and backup policy"]),
  "gcp-monitoring": componentFields(["project-scope", "Project / scope", "Monitored project or resource scope"], ["metrics", "Metrics", "Metric types, log-based metrics, or traces"], ["alert-policy", "Alert policy", "Condition, threshold, and duration"], ["notification", "Notification", "Notification channel or incident destination"]),
  "gcp-secret-manager": componentFields(["secret-id", "Secret ID", "Secret resource name; never enter the secret value"], ["consumers", "Consumers", "Services or service accounts that access it"], ["rotation", "Rotation", "Rotation schedule or Pub/Sub notification"], ["replication", "Replication", "Automatic or user-managed replica locations"]),
  "gcp-cloud-dns": componentFields(["managed-zone", "Managed zone", "Zone name and DNS suffix"], ["records", "DNS records", "Record name, type, and target per line"], ["visibility", "Visibility", "Public or private zone and associated VPCs"], ["dnssec", "DNSSEC", "DNSSEC signing configuration"]),
  "gcp-firewall": componentFields(["direction-priority", "Direction / priority", "Ingress or egress and rule priority"], ["source-target", "Source / target", "CIDR ranges, tags, or service accounts"], ["protocol-ports", "Protocols / ports", "Allowed or denied protocol and port ranges"], ["network", "VPC network", "Network where the rule applies"]),
});

for (const component of CLOUD_PROVIDER_COMPONENTS) {
  if (MODEL_COMPONENT_FIELDS[component.kind]) continue;
  MODEL_COMPONENT_FIELDS[component.kind] = componentFields(
    ["resource-name", "Resource name", "Service, instance, or resource identifier"],
    ["region", "Region / location", "Region, zone, or deployment location"],
    ["configuration", "Configuration", "Important settings, policy, or dependencies"],
  );
}

for (const component of CLOUD_NEUTRAL_COMPONENTS) {
  MODEL_COMPONENT_FIELDS[component.kind] = componentFields(
    ["resource-name", "Resource name", "Service, instance, or resource identifier"],
    ["region", "Region / location", "Region, zone, or deployment location"],
    ["configuration", "Configuration", "Important settings, policy, or dependencies"],
  );
}

for (const component of PROPOSAL_COMPONENTS) {
  MODEL_COMPONENT_FIELDS[component.kind] = proposalComponentFields(component.kind);
}

export function defaultLibraryComponentFields(kind: LibraryComponentKind): LibraryComponentFieldValue[] {
  return MODEL_COMPONENT_FIELDS[kind]?.map(field => ({ ...field })) ?? [];
}

export function buildLibraryComponent(kind: LibraryComponentKind, x: number, y: number, options?: { chartData?: LibraryChartData; uiComponent?: import("../../model").UiComponentRecord; portCount?: number; forceLegacyGeometry?: boolean }): GroupElement {
  const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind);
  if (!definition) throw new Error(`Unknown library component: ${kind}`);
  if (!options?.forceLegacyGeometry) {
    const componentFields = defaultLibraryComponentFields(kind);
    const chartData = options?.chartData ?? defaultLibraryChartData(kind);
    const uiComponent = options?.uiComponent ?? defaultLibraryUiComponent(kind);
    return {
      type: "group", id: crypto.randomUUID(), elements: [],
      componentBounds: { x, y, w: definition.width, h: definition.height },
      ...((kind === "diagram-frame" || kind === "diagram-swimlane") ? { container: { kind: kind === "diagram-frame" ? "frame" as const : "swimlane" as const, name: definition.label, clipChildren: false, autoResize: false, padding: 20 } } : {}),
      libraryComponent: {
        kind, label: definition.label,
        ...(usesCleanModelRenderer(kind) ? { renderStyle: "clean" as const } : {}),
        ...(componentFields.length ? { componentFields } : {}),
        ...(chartData ? { chartData } : {}),
        ...(uiComponent ? { uiComponent } : {}),
        ...(kind === "diagram-swimlane" ? { laneCount: 3 } : {}),
        ...(kind === "network-hub" ? { portCount: options?.portCount ?? 8 } : kind === "network-switch" ? { portCount: options?.portCount ?? 6 } : {}),
      },
    };
  }
  if (isUiComponentKind(kind)) {
    const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind)!;
    const uiComponent = options?.uiComponent ?? defaultLibraryUiComponent(kind);
    return {
      type: "group", id: crypto.randomUUID(), elements: [],
      componentBounds: { x, y, w: definition.width, h: definition.height },
      libraryComponent: {
        kind, label: definition.label,
        ...(uiComponent ? { uiComponent } : {}),
      },
    };
  }
  if (kind.startsWith("viz-")) {
    const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind)!;
    return { type: "group", id: crypto.randomUUID(), elements: [], componentBounds: { x, y, w: definition.width, h: definition.height }, libraryComponent: { kind, label: definition.label, chartData: options?.chartData ?? defaultLibraryChartData(kind) } };
  }
  // The legacy wireless access point renderer already supports component bounds;
  // keep its familiar symbol while making the whole device a connection target.
  if (kind === "network-access-point") {
    const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind)!;
    return { type: "group", id: crypto.randomUUID(), elements: [], componentBounds: { x, y, w: definition.width, h: definition.height }, libraryComponent: { kind, label: definition.label } };
  }
  if (usesCleanModelRenderer(kind)) {
    const definition = LIBRARY_COMPONENTS.find(item => item.kind === kind)!;
    return {
      type: "group", id: crypto.randomUUID(), elements: [],
      componentBounds: { x, y, w: definition.width, h: definition.height },
      ...((kind === "diagram-frame" || kind === "diagram-swimlane") ? { container: { kind: kind === "diagram-frame" ? "frame" as const : "swimlane" as const, name: definition.label, clipChildren: false, autoResize: false, padding: 20 } } : {}),
      libraryComponent: { kind, label: definition.label, renderStyle: "clean", ...(kind === "diagram-swimlane" ? { laneCount: 3 } : {}), ...(kind === "network-hub" ? { portCount: options?.portCount ?? 8 } : kind === "network-switch" ? { portCount: options?.portCount ?? 6 } : {}) },
    };
  }
  const elements: Element[] = [];
  const titled = (color: string, fontSize = 12) => ({ text: "", color, fontSize, fontFamily: "sans" as const, bold: true, italic: false, underline: false, textAlign: "center" as const, listType: "none" as const, verticalAlign: "middle" as const });
  if (kind === "uml-actor") {
    const color = "#7563ad";
    elements.push({ type: "circle", x: x + 22, y: y + 2, w: 20, h: 20, color, thickness: 1.8, fillColor: "#f6f2ff" });
    elements.push(lineElement(x + 32, y + 22, 0, 42, color), lineElement(x + 13, y + 39, 38, 0, color), lineElement(x + 32, y + 64, -18, 28, color), lineElement(x + 32, y + 64, 18, 28, color));
  } else if (kind === "uml-use-case") {
    elements.push({ type: "circle", x, y, w: 174, h: 90, color: "#7563ad", thickness: 1.7, fillColor: "#f6f2ff", label: titled("#59488c") });
  } else if (kind === "uml-package") {
    elements.push({ type: "flowchart", x, y, w: 190, h: 132, color: "#7563ad", thickness: 1.6, fillColor: "#f6f2ff", flowchartShape: "folder", label: titled("#59488c") });
  } else if (kind === "uml-interface") {
    elements.push(rect(x, y, 190, 124, "#f6f2ff", "#7563ad", 8));
    elements.push(text(x + 12, y + 8, "<<interface>>", "#7563ad", 10, "sans", true), text(x + 12, y + 29, "", "#59488c", 13, "sans", true));
    elements.push(lineElement(x, y + 52, 190, 0, "#9c8bc9"), text(x + 12, y + 65, "", "#59488c", 12, "mono"));
  } else if (kind === "uml-class") {
    elements.push(rect(x, y, 230, 154, "#f8fbff", "#7e94ad", 9), rect(x, y, 230, 36, "#e8f0fb", "#7e94ad", 9));
    elements.push(lineElement(x, y + 36, 230, 0), lineElement(x, y + 92, 230, 0));
    elements.push(text(x + 12, y + 9, "", "#345371", 14, "sans", true));
    elements.push(text(x + 12, y + 48, "", "#334453", 12, "mono"));
    elements.push(text(x + 12, y + 105, "", "#334453", 12, "mono"));
  } else if (kind === "uml-lifeline") {
    elements.push({ ...rect(x + 12, y, 130, 42, "#edf4ff", "#7e94ad", 8), label: { text: "", color: "#345371", fontSize: 12, fontFamily: "sans", bold: true, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "middle" } });
    elements.push({ ...lineElement(x + 77, y + 42, 0, 200, "#8497a8", true), componentRole: "lifeline-line" });
  } else if (kind === "uml-activation") {
    elements.push(rect(x + 5, y, 18, 82, "#d7e6f8", "#6887a6", 3));
  } else if (kind.startsWith("uml-") && ["uml-inheritance", "uml-realization", "uml-aggregation", "uml-composition"].includes(kind)) {
    const dashed = kind === "uml-realization"; const relation = lineElement(x + 24, y + 21, 148, 0, "#657b91", dashed); relation.endHead = kind === "uml-inheritance" || dashed ? "open" : "none"; elements.push(relation);
    if (kind === "uml-aggregation" || kind === "uml-composition") elements.push({ type: "diamond", x: x + 9, y: y + 15, w: 12, h: 12, color: "#657b91", thickness: 1.4, fillColor: kind === "uml-composition" ? "#657b91" : "#ffffff" });
  } else if (kind === "sequence-sync" || kind === "sequence-async") {
    const message = lineElement(x + 5, y + 25, 174, 0, "#617a92"); message.endHead = kind === "sequence-async" ? "open" : "solid"; message.label = { text: "", color: "#617a92", fontSize: 12, fontFamily: "sans", bold: false, italic: false, underline: false, textAlign: "center", listType: "none", verticalAlign: "top" }; elements.push(message);
  } else if (kind === "er-table") {
    elements.push(rect(x, y, 220, 156, "#fbfcfe", "#879caf", 9), rect(x, y, 220, 32, "#e8f0f7", "#879caf", 9));
    elements.push(text(x + 12, y + 9, "", "#36556e", 13, "sans", true));
    elements.push(lineElement(x, y + 32, 220, 0), lineElement(x, y + 73, 220, 0), lineElement(x, y + 114, 220, 0));
    elements.push(text(x + 10, y + 43, "", "#536477", 11, "mono"), text(x + 10, y + 84, "", "#536477", 11, "mono"), text(x + 10, y + 125, "", "#536477", 11, "mono"));
  } else if (["er-entity", "er-weak-entity", "er-associative-entity", "er-relationship", "er-identifying-relationship", "er-attribute", "er-composite-attribute", "er-key-attribute", "er-partial-key-attribute", "er-multivalued-attribute", "er-derived-attribute"].includes(kind)) {
    // Use ordinary editable canvas shapes for Chen ER entities, relations, and attributes.
    const outline = "#000000";
    const fill = "#ffffff";
    const label = (underline = false) => ({ text: "", color: "#000000", fontSize: 12, fontFamily: "sans" as const, bold: false, italic: false, underline, textAlign: "center" as const, listType: "none" as const, verticalAlign: "middle" as const });
    const entity = (inset = 0, withLabel = false) => ({ type: "rectangle" as const, x: x + inset, y: y + inset, w: 148 - inset * 2, h: 82 - inset * 2, color: outline, thickness: 1.6, fillColor: fill, ...(withLabel ? { label: label() } : {}) });
    const relation = (inset = 0, withLabel = false) => ({ type: "diamond" as const, x: x + inset, y: y + inset, w: 148 - inset * 2, h: 88 - inset * 2, color: outline, thickness: 1.6, fillColor: fill, ...(withLabel ? { label: label() } : {}) });
    const attribute = (inset = 0, withLabel = false, underline = false, dashed = false) => ({ type: "circle" as const, x: x + inset, y: y + inset, w: 148 - inset * 2, h: 70 - inset * 2, color: outline, thickness: 1.6, fillColor: fill, ...(dashed || kind === "er-derived-attribute" || kind === "er-partial-key-attribute" ? { lineStyle: "dashed" as const } : {}), ...(withLabel ? { label: label(underline) } : {}) });
    if (kind === "er-entity") elements.push(entity(0, true));
    else if (kind === "er-weak-entity") elements.push(entity(0), entity(6, true));
    else if (kind === "er-associative-entity") elements.push(entity(0, true), { type: "diamond", x: x + 64, y: y + 2, w: 20, h: 20, color: outline, thickness: 1.6, fillColor: fill });
    else if (kind === "er-relationship") elements.push(relation(0, true));
    else if (kind === "er-identifying-relationship") elements.push(relation(0), relation(7, true));
    else if (kind === "er-key-attribute") elements.push(attribute(0, true, true));
    else if (kind === "er-partial-key-attribute") elements.push(attribute(0, true, true, true));
    else if (kind === "er-multivalued-attribute") elements.push(attribute(0), attribute(6, true));
    else if (kind === "er-composite-attribute") {
      const parent = { type: "circle" as const, x: x + 36, y: y + 2, w: 76, h: 44, color: outline, thickness: 1.6, fillColor: fill, label: label() };
      const leftChild = { type: "circle" as const, x: x + 2, y: y + 82, w: 94, h: 44, color: outline, thickness: 1.6, fillColor: fill, label: { ...label(), text: "Attribute 1" } };
      const rightChild = { type: "circle" as const, x: x + 124, y: y + 82, w: 94, h: 44, color: outline, thickness: 1.6, fillColor: fill, label: { ...label(), text: "Attribute 2" } };
      elements.push(lineElement(x + 74, y + 45, -25, 38, outline), lineElement(x + 75, y + 45, 96, 38, outline), parent, leftChild, rightChild);
    }
    else elements.push(attribute(0, true));
  } else if (kind === "er-one-many" || kind === "er-many-one" || kind === "er-one-one" || kind === "er-many-many") {
    elements.push(lineElement(x + 8, y + 10, 174, 0, "#000000"));
    const foot = (fx: number, fy: number, direction: number) => [lineElement(fx, fy, direction * 12, -10, "#000000"), lineElement(fx, fy, direction * 12, 0, "#000000"), lineElement(fx, fy, direction * 12, 10, "#000000")];
    const one = (fx: number) => lineElement(fx, y, 0, 20, "#000000");
    if (kind === "er-many-many") elements.push(...foot(x + 9, y + 10, 1), ...foot(x + 181, y + 10, -1));
    else if (kind === "er-one-one") elements.push(one(x + 9), one(x + 181));
    else if (kind === "er-many-one") elements.push(...foot(x + 9, y + 10, 1), one(x + 181));
    else elements.push(one(x + 9), ...foot(x + 181, y + 10, -1));
  }
  const defaultLabel = LIBRARY_COMPONENTS.find(item => item.kind === kind)?.label ?? kind;
  elements.forEach(element => { if ((element.type === "rectangle" || element.type === "circle" || element.type === "diamond" || element.type === "triangle" || element.type === "flowchart" || element.type === "line" || element.type === "arrow") && element.label && !element.label.text.trim()) element.label = { ...element.label, text: defaultLabel }; });
  const palette = kind.startsWith("uml-") || kind.startsWith("sequence-")
    ? { fill: "#f6f2ff", header: "#e9e3f7", edge: "#7563ad", ink: "#59488c" }
    : kind.startsWith("er-")
      ? { fill: "#ffffff", header: "#ffffff", edge: "#000000", ink: "#000000" }
      : { fill: "#eef5fa", header: "#dfeaf2", edge: "#527d9b", ink: "#3d6384" };
  if (!isUiComponentKind(kind)) elements.forEach((element, index) => {
    if (element.type === "text") element.color = palette.ink;
    else if (element.type === "freehand") element.color = palette.edge;
    else if (element.type !== "image" && element.type !== "schemaTable" && element.type !== "group") {
      element.color = palette.edge;
      if ("fillColor" in element && element.fillColor) element.fillColor = kind === "uml-aggregation" && element.type === "diamond" ? "#ffffff" : index === 1 && ["uml-class", "er-table"].includes(kind) ? palette.header : palette.fill;
      if (element.label) element.label = { ...element.label, color: palette.ink };
    }
  });
  return { type: "group", elements };
}
