# Research: modelling components and code-to-drawing support

Researched 1 November 2026. This is a proposal for the next expansion of SketchDraw, not an implementation. It combines official notation and format documentation with a static review of the repository. The component inventory below is intentionally broad so you can choose a smaller first release.

## Recommendation

SketchDraw currently defines about **322 reusable library components** across its general diagram, UML, BPMN, database, software, network, cloud, GUI, and chart catalogs. The basic shape and flowchart catalogs are separate and add roughly 60 more drawing tools. A first target of **500 library components** therefore needs about **178 additional catalog entries**. The tables below contain **321 candidate entries**. If all became distinct reusable components, the library would reach about 643; some are configurable variants or may overlap existing behavior, so count only distinct, useful additions toward the target.

Treat “component” as a useful, searchable palette entry backed by shared drawing behavior—not as a separate renderer or custom class for every icon. A single semantic shape can have several clearly named presets when the presets have different ports, labels, properties, or code mappings. Decorative duplicates should not count toward the 500.

I recommend that the first 500 include portable generic notation and only a modest number of provider-specific icons. Cloud vendors update their icon sets, so those are better handled as separately versioned asset packs. Official AWS, Azure, and Google Cloud icon pages publish product assets and usage rules; those pages should be checked before bundling their files. [AWS architecture icons](https://aws.amazon.com/architecture/icons/), [Azure architecture icons and terms](https://learn.microsoft.com/en-us/azure/architecture/icons/), [Google Cloud product icons](https://cloud.google.com/icons)

## What SketchDraw already has

Counts below come from the repository's current catalog declarations, not from profiling or a runtime palette scrape. The total is approximate because some kinds are assembled from generated definitions.

| Area | Present behavior |
| --- | --- |
| Library palette | About 322 entries, including 32 GUI definitions, 99 provider-specific cloud definitions, and 50 provider-neutral definitions. |
| Standard shapes | Basic geometry, flowchart symbols, and general-purpose shapes have their own catalog. They are not included in the 322 library-component count. |
| Live diagram editing | Mermaid flowcharts and sequences, a subset of extended Mermaid class/ER/state/journey/Gantt/C4 diagrams, a subset of PlantUML class/object diagrams, D2, a cloud DSL, and org-chart CSV. |
| Static diagram/code import | DOT, D2, CSV, SQL/JSON schema editing, Mermaid, and PlantUML. Mermaid and PlantUML support is partial and should report unsupported syntax instead of silently dropping it. |
| Structured-source import | JSON, Terraform, Kubernetes YAML, Docker Compose, Ansible YAML, OpenAPI, CloudFormation, Azure ARM, Bicep, and generic YAML dispatch. VSDX import reads editable content from the first page. |
| Diagram-code export | Mermaid, DOT, D2, CSV, PlantUML, SQL, and JSON Schema. Export deliberately simplifies information that the target syntax cannot express. |
| Other relevant behavior | Cloud provider icons and neutral cloud architecture shapes; BPMN analysis/simulation; data schema cards that redraw from SQL or JSON schema source. |

Useful code locations include src/features/components/library-components.ts, src/features/components/gui-components.ts, src/features/diagrams/cloud-providers.ts, src/features/diagrams/live-diagram.ts, src/features/diagrams/mermaid-extended.ts, src/features/diagrams/code-formats.ts, src/features/diagrams/structured-data.ts, src/features/diagrams/dot.ts, src/features/diagrams/d2.ts, and src/features/diagrams/visio-vsdx.ts.

## Component catalog candidates

Each entry says what the symbol is for and what makes it behave differently from a generic rectangle. The list is a menu of candidates; shared shape primitives, text, connectors, and containers should supply most of the implementation.

### Systems engineering and advanced UML

| Component | Use and behavior |
| --- | --- |
| SysML requirement | Record an ID, requirement text, risk, and verification method in a compartmented card. |
| Requirement stakeholder | Show who needs a requirement; connect it to requirements with a typed relationship. |
| Requirement test case | Represent a verification procedure and its pass/fail evidence link. |
| Requirement risk | Mark a requirement's risk and mitigation without changing the requirement text. |
| Requirement decomposition link | Connect a parent requirement to derived child requirements. |
| Requirement satisfy link | Connect a design block to a requirement it fulfills. |
| Requirement verify link | Connect a test case to the requirement it verifies. |
| Requirement derive link | Show a lower-level requirement derived from another requirement. |
| Requirement refine link | Relate a model element that adds detail to a requirement. |
| Requirement trace link | Keep a generic trace relationship with an editable relationship label. |
| SysML block | Describe system structure, value properties, parts, and references in compartments. |
| Part property | Show a contained instance as a property inside a SysML block. |
| Reference property | Show an external or shared block reference without implying composition. |
| Value property | Store a named value with an optional unit such as seconds or kilograms. |
| Value type | Define a reusable measurement type and its unit. |
| Constraint block | Hold named inputs, outputs, and constraint expressions. |
| Parametric constraint | Connect value properties to an equation or inequality. |
| Interface block | Describe the contract and flows exposed between system blocks. |
| Full port | Represent a port that owns its provided or required interface features. |
| Proxy port | Represent a delegated interface that forwards through its owning block. |
| Item flow | Label what information, material, or energy travels along a connector. |
| Allocation relationship | Assign an activity, requirement, or function to a structural element. |
| Activity partition | Create a swimlane tied to an actor, system, or responsibility. |
| Object node | Show an input or output object flowing through an activity. |
| Action pin | Attach a typed input or output pin to an activity action. |
| Send signal action | Model an action that emits a signal to another process. |
| Accept signal action | Model a waiting action that resumes when a signal arrives. |
| Time event | Trigger a state transition after a duration or at a specified time. |
| Change event | Trigger a state transition when a Boolean condition changes to true. |
| Protocol state | Show an allowed lifecycle state for a protocol or interface. |
| UML combined fragment | Add an alt, opt, loop, par, or break frame over selected lifelines. |
| UML communication message | Label a message on a network of lifeline objects without forcing a time axis. |
| UML port | Put a typed interaction point on a component or composite structure. |
| Provided interface | Show an interface a component offers, using a lollipop connector endpoint. |
| Required interface | Show an interface a component consumes, using a socket connector endpoint. |
| Composite part connector | Join part properties inside a composite structure frame. |
| Package import | Show that one UML package imports definitions from another. |
| Package merge | Show that a package incorporates and merges another package's contents. |

### BPMN and decision modelling

| Component | Use and behavior |
| --- | --- |
| Conditional event | Start, catch, or throw a process event when a condition becomes true. |
| Escalation event | Raise or catch a business escalation without treating it as a technical error. |
| Compensation event | Invoke or catch compensating work for an earlier completed action. |
| Link event | Connect distant points in one process without drawing a long sequence flow. |
| Multiple event | Represent one of several possible event definitions on a single BPMN marker. |
| Parallel multiple event | Wait for or emit multiple event definitions together. |
| Cancel event | Model cancellation inside a BPMN transaction subprocess. |
| Event subprocess | Place an interrupting or non-interrupting event-triggered process inside a participant. |
| Transaction subprocess | Mark a subprocess whose actions are treated as one transaction with cancel behavior. |
| Ad hoc subprocess | Group work whose contained activities do not have one fixed sequence. |
| Choreography task | Show a message exchange between named participants, rather than work inside one pool. |
| Call choreography | Invoke a reusable choreography definition. |
| Conversation node | Group related message exchanges at a high level. |
| BPMN message | Label the content or name of a message flowing between participants. |
| Data input | Show data made available to a process or activity. |
| Data output | Show data produced by a process or activity. |
| Data collection | Mark a set of records used or produced by an activity. |
| Data association | Connect data objects to an activity with input/output direction. |
| BPMN message flow | Connect participants across pools with a dashed message connector. |
| DMN decision | Capture a decision name, question, and result value. |
| DMN input data | Identify an input variable consumed by a decision. |
| DMN knowledge source | Cite a policy, regulation, or authority supporting a decision. |
| Business knowledge model | Package reusable decision logic for invocation by decisions. |
| DMN decision service | Expose a selected set of decisions as a callable service. |
| DMN decision table | Edit input clauses, rules, outputs, and hit policy in a table-shaped component. |
| DMN invocation | Show a decision invoking a reusable business knowledge model. |
| DMN information requirement | Connect input data or another decision to a decision. |
| DMN knowledge requirement | Connect a knowledge source or business knowledge model to a decision. |
| DMN authority requirement | Connect a decision to the authority that governs it. |
| DMN context expression | Represent a named set of intermediate values used to calculate a decision. |

### Database, data structures, and schemas

| Component | Use and behavior |
| --- | --- |
| Document database | Represent a document store with collection and document annotations. |
| Document collection | Show a group of JSON-like documents and its key fields. |
| Key-value bucket | Show a key/value store and its partition or expiry settings. |
| Wide-column table | Represent row keys, column families, and sparse columns. |
| Graph vertex | Model a typed vertex in a graph database. |
| Graph edge type | Name a directed or undirected graph relationship and its properties. |
| Vector store | Show vector storage, dimensions, metadata filters, and retrieval purpose. |
| Embedding record | Represent a source item, vector, and metadata payload. |
| Search index | Show indexed fields, analyzers, and the source dataset. |
| Event schema | Define a named event with versioned fields and producer/consumer links. |
| Avro record | Show a record schema with fields and optional union/null types. |
| Protocol Buffer message | Show a protobuf message and numbered fields. |
| GraphQL object type | Represent a typed object with fields and scalar/object references. |
| GraphQL enum | List a finite set of values used by a schema field. |
| GraphQL interface | Define fields shared by multiple implementing object types. |
| GraphQL union | Show a field that can return one of several object types. |
| GraphQL resolver | Attach a resolver or source mapping to a field. |
| JSON Schema object | Show object properties, required fields, and nested schema references. |
| Standalone database column | Document a field's type, nullability, default, and description. |
| Primary key group | Mark a single or composite primary key across a table card. |
| Foreign key group | Mark one or more columns that reference a target table. |
| Unique constraint | Name columns that must be unique together. |
| Check constraint | Display a database predicate enforced on stored rows. |
| Partition key | Mark how a large table or collection is divided across partitions. |
| Table partition | Show a child partition, its range/list rule, and parent table. |
| Fact table | Model measurable events and foreign keys in a dimensional warehouse. |
| Dimension table | Model descriptive attributes used to slice warehouse measures. |
| Bridge table | Resolve many-to-many relationships between dimensions or facts. |
| Slowly changing dimension | Show a dimension's history strategy, such as overwrite or effective dates. |
| Star schema boundary | Enclose one fact table and its related dimensions as a visual group. |
| Source dataset | Identify an upstream file, service, or database feeding a data model. |
| Data contract | Document schema, owner, quality expectations, and compatibility rules. |
| Data classification badge | Mark a dataset as public, internal, confidential, or restricted. |
| Data lineage connector | Label a directed dataset-to-dataset transformation relationship. |
| Data quality check | Show a rule, threshold, and pass/fail output beside a dataset. |

### Software architecture and integration patterns

| Component | Use and behavior |
| --- | --- |
| Web frontend | Identify a browser client, framework, route, and owning team. |
| Mobile client | Identify a mobile application and the APIs or local services it uses. |
| Background worker | Show a long-running asynchronous process with its queue and outputs. |
| Batch job | Show a finite scheduled workload with input, schedule, and result. |
| Scheduler | Trigger one or more jobs according to a named schedule. |
| API operation | Record method, path, authentication, and request/response type. |
| GraphQL endpoint | Show a GraphQL service, schema, and client relationships. |
| gRPC service | Record service methods and protobuf request/response types. |
| Webhook endpoint | Show an inbound callback URL, event type, and signature check. |
| Event producer | Publish named event types to a topic or broker. |
| Event consumer | Subscribe to event types and show retry or acknowledgement behavior. |
| Event topic | Group messages by topic, retention, and partition count. |
| Stream partition | Show one ordered partition within a stream or topic. |
| Saga orchestrator | Coordinate steps, compensations, and state for a long-running transaction. |
| Saga participant | Show a service step and its forward/compensation operations. |
| Transactional outbox | Show an outbox table that relays committed changes to a message broker. |
| Change data capture | Capture database changes and route them to downstream consumers. |
| Service mesh sidecar | Pair a workload with proxy behavior for routing, telemetry, and policy. |
| Circuit breaker | Mark a call boundary with closed/open/half-open state annotations. |
| Adapter | Translate one interface or data contract into another. |
| Backend-for-frontend | Show a client-specific aggregation layer between UI and backend services. |
| Bounded context | Enclose a domain model and label its language or ownership boundary. |
| Aggregate root | Mark a consistency boundary and its contained domain entities. |
| Domain entity | Show a domain object identified by a stable identity. |
| Value object | Show an immutable domain value defined by its attributes. |
| Domain event | Record a fact that occurred and its timestamp or version. |
| Application component | Show an application-level unit in an ArchiMate-style view. |
| Application service | Show externally visible application behavior used by a process or actor. |
| Business actor | Represent a person or organization participating in a business architecture. |
| Business role | Represent a responsibility that can be assigned to actors. |
| Business process | Represent a high-level business activity linked to roles and services. |
| Data object | Show a logical information object used or produced by an application. |
| Technology node | Show a runtime or infrastructure node hosting applications or artifacts. |

### Networking, security, operations, and deployment

| Component | Use and behavior |
| --- | --- |
| VLAN | Mark a layer-2 broadcast domain and optionally display its VLAN ID. |
| VRF | Separate routing tables on shared network equipment. |
| DMZ boundary | Enclose services exposed between public and trusted networks. |
| Trust boundary | Mark a security context crossing that requires threat review. |
| SD-WAN edge | Show a site edge that selects among multiple WAN paths. |
| MPLS cloud | Group provider-managed label-switched paths between sites. |
| Private service link | Show private connectivity from a VPC/VNet to a managed service. |
| Fiber link | Show an optical connection with speed or wavelength annotation. |
| Coax link | Show a coaxial segment used for cable access or RF distribution. |
| Wi-Fi radio link | Show a wireless connection with band, SSID, or security annotation. |
| Cellular link | Show a mobile carrier path and optional 4G/5G label. |
| Network rack | Represent a rack enclosure with editable U positions and mounted devices. |
| Patch panel | Show ports and the cabling map between rack devices. |
| Network TAP | Mark a passive copy point for packet monitoring. |
| Web application firewall | Distinguish HTTP-layer filtering from a generic network firewall. |
| Intrusion detection sensor | Show passive detection and the telemetry destination. |
| Intrusion prevention sensor | Show inline inspection and its block/allow action. |
| DDoS protection | Show traffic scrubbing or rate protection at a named edge. |
| Access control point | Show a badge, door, or policy checkpoint in a physical security plan. |
| Threat actor | Describe an adversary profile, capability, and motivation. |
| Threat scenario | Record a threat and affected asset with a risk rating. |
| Vulnerability | Mark a weakness and connect it to an affected asset or threat. |
| Attack step | Build an ordered attack path or attack tree branch. |
| Security control | Document a preventive, detective, or corrective safeguard. |
| Threat mitigation | Link a threat scenario to the control intended to reduce it. |
| Security requirement | Track an identity, encryption, logging, or recovery requirement. |
| Audit event | Show an event source, retained fields, and monitoring destination. |
| IAM policy | Display principal, action, resource, and condition in a compact policy card. |
| Certificate authority | Show certificate issuance and trust-chain relationships. |
| Cryptographic key | Show key purpose, owner, rotation, and dependent services. |
| Backup policy | Record schedule, retention, encryption, and recovery target. |
| Edge site | Mark a customer or factory location with local compute and connectivity. |
| Edge workload | Show processing performed near a device or site rather than in a central cloud. |
| Deployment ring | Show staged rollout cohorts such as internal, canary, and general release. |
| Blue-green environment | Pair two production environments and mark the active traffic target. |
| Canary deployment | Mark a limited traffic cohort and its promotion/rollback gate. |
| Rolling deployment | Show sequential replacement of service replicas with health gates. |
| Rollback checkpoint | Mark a release step that can restore a prior known-good version. |
| Build artifact | Show an immutable package or image produced by a pipeline. |
| Artifact signing step | Mark signing and verification boundaries in a delivery pipeline. |

### Visual planning and decision tools

These are diagram shapes and workshop layouts. They would remain visual objects; assignments, schedules, and tracked project records continue to belong to the separate Planning workspace.

| Component | Use and behavior |
| --- | --- |
| Opportunity statement | Frame a problem, affected audience, and desired outcome. |
| User persona | Summarize a user group, needs, constraints, and goals. |
| SWOT quadrant | Provide editable strengths, weaknesses, opportunities, and threats regions. |
| PESTLE map | Organize political, economic, social, technology, legal, and environmental factors. |
| Assumption map | Place assumptions by importance and evidence confidence. |
| Impact/effort matrix | Sort ideas by expected impact and implementation effort. |
| RICE score card | Compare reach, impact, confidence, and effort using editable values. |
| ICE score card | Compare ideas by impact, confidence, and ease. |
| MoSCoW group | Label Must, Should, Could, and Won't categories in a prioritization board. |
| Weighted decision matrix | Compare options against weighted criteria and show a calculated total. |
| Decision tree node | Branch options with condition, probability, or consequence labels. |
| Risk matrix | Place risks on a configurable likelihood-by-impact grid. |
| RAID register row | Track one risk, assumption, issue, or dependency with an owner field. |
| RACI matrix | Map roles to responsible, accountable, consulted, and informed cells. |
| Stakeholder map | Arrange people or groups by influence and interest. |
| Customer journey stage | Organize a journey into named phases with goals and concerns. |
| Journey touchpoint | Record a user action, channel, or service interaction within a stage. |
| Journey emotion curve | Plot satisfaction or friction over journey stages. |
| Empathy map | Separate what a user says, thinks, does, and feels. |
| Service blueprint | Pair customer actions with frontstage, backstage, and support-process lanes. |
| Event-storming command | Record an intent that causes a domain event. |
| Event-storming event | Record a domain fact and its place on a time-ordered wall. |
| Event-storming policy | Connect an event to an automatic rule or follow-up command. |
| Event-storming read model | Show information a user or service needs to make a decision. |
| Event-storming external system | Mark an outside dependency that participates in a domain flow. |
| Impact-mapping goal | State the business outcome at the root of an impact map. |
| Impact-mapping actor | Identify a person or system able to affect the goal. |
| Impact-mapping impact | Show a behavior change expected from an actor. |
| Impact-mapping deliverable | Show a product or change intended to create an impact. |
| Story-map activity | Create a top-level user activity in a story-map backbone. |
| Story-map task | Add a user task under an activity and arrange release slices. |
| Work package | Represent a deliverable, owner, and optional parent in a WBS diagram. |
| Milestone marker | Mark a significant date or completion point on a timeline. |
| Dependency connector | Show finish-to-start, start-to-start, finish-to-finish, or blocking links. |
| Critical-path task | Emphasize a task on the calculated critical path when dates and durations exist. |
| Roadmap lane | Organize themes or teams across a time-based roadmap. |
| Release milestone | Label a target release or deployment checkpoint. |
| Objective card | State an objective with an optional time period. |
| Key-result card | State a measurable result linked to an objective. |

### Wireframing and user-interface planning

| Component | Use and behavior |
| --- | --- |
| Responsive screen frame | Enclose a screen at a named breakpoint and provide a resize preset. |
| Browser window | Show browser chrome and an editable viewport for web wireframes. |
| Mobile device frame | Provide a phone-sized viewport with camera/safe-area guides. |
| Tablet device frame | Provide a tablet viewport with landscape and portrait sizing. |
| Desktop application window | Show a title bar, content area, and optional window controls. |
| Bottom navigation | Present mobile destinations with one selected item. |
| Side drawer | Show an overlay or persistent navigation drawer in an app screen. |
| Bottom sheet | Show a partial-height mobile panel with a drag handle. |
| Tooltip | Add short help text anchored to a UI control. |
| Popover | Show a compact anchored menu or information panel. |
| Command palette | Sketch a searchable command list with keyboard hint rows. |
| Empty state | Show a no-content illustration, explanatory message, and optional action. |
| Skeleton loading state | Show placeholder blocks that match the intended loaded content. |
| Error state | Show an error message, recovery action, and optional diagnostic details. |
| Loading indicator | Show a spinner or progress indicator with a status label. |
| Sign-in panel | Lay out identity fields, validation, and primary authentication actions. |
| File drop zone | Show drag-and-drop area, accepted file types, and browse action. |
| Filter toolbar | Combine search, filter chips, sort selection, and clear-all action. |
| Search result row | Show title, matched excerpt, category, and optional trailing action. |
| Notification center | Group notification rows by unread/read state and timestamp. |
| Code editor panel | Sketch a plain-text editor region with line numbers and diagnostics. |
| Validation summary | Group field errors and link them to corresponding form controls. |
| Breakpoint marker | Mark where a layout changes between screen widths. |
| Accessibility focus ring | Demonstrate keyboard focus order and visible focus treatment. |

### Electrical, process, facilities, and physical systems

| Component | Use and behavior |
| --- | --- |
| Battery | Show a DC source with editable voltage and polarity. |
| AC voltage source | Show a sinusoidal source with voltage and frequency fields. |
| Ground | Provide an electrical reference node for connected wires. |
| Resistor | Show a passive component with resistance value and pin endpoints. |
| Capacitor | Show capacitance and optional polarized orientation. |
| Inductor | Show inductance and optional winding details. |
| Diode | Show anode/cathode direction and optional part label. |
| LED | Show diode direction plus color and forward-voltage note. |
| BJT transistor | Show collector, base, and emitter pins with NPN/PNP variant. |
| MOSFET | Show drain, gate, and source pins with N/P channel variant. |
| Operational amplifier | Show positive/negative inputs, output, and supply pins. |
| Fuse | Show a replaceable overcurrent protection element and rating. |
| Circuit breaker | Show a resettable protection element and current rating. |
| SPST switch | Show one pole and one throw with open/closed state. |
| Push button | Show momentary normally-open or normally-closed state. |
| Relay | Show a coil and one or more mechanically linked contacts. |
| Transformer | Show primary/secondary windings and turns ratio. |
| Lamp | Show a load with power rating and optional status state. |
| Electric motor | Show a motor load with phase and speed annotation. |
| Connector | Show a named multi-pin connector with pin numbers. |
| Terminal block | Show a row of numbered electrical terminals. |
| AND gate | Show logic inputs and output with a Boolean function label. |
| OR gate | Show logic inputs and output with a Boolean function label. |
| NOT gate | Show an inverter with input and output bubbles. |
| NAND gate | Show an AND function with an inverted output. |
| NOR gate | Show an OR function with an inverted output. |
| XOR gate | Show an exclusive-or function for digital logic diagrams. |
| Electrical bus | Join multiple signals while preserving named taps. |
| Junction dot | Mark an electrical wire connection distinctly from a crossing. |
| Pump | Show a process fluid pump with suction/discharge ports and tag number. |
| Gate valve | Show an isolation valve with open/closed state. |
| Check valve | Show one-way flow and direction. |
| Ball valve | Show quarter-turn shutoff state. |
| Control valve | Show a modulating valve with controller signal port. |
| Storage tank | Show a tank with level, capacity, and inlet/outlet ports. |
| Heat exchanger | Show hot/cold streams with inlet and outlet connections. |
| Compressor | Show a gas-compression unit with pressure annotations. |
| Filter | Show a fluid or air filtering step with a replaceable element. |
| Flow meter | Measure and label a flow on a connected process line. |
| Instrument bubble | Show a tagged measurement or control instrument using ISA-style letters. |
| Control loop | Link sensor, controller, and final control element as a named loop. |
| Pressure relief valve | Show an overpressure safety outlet and set pressure. |
| Pipe junction | Split or merge process lines with visible connection points. |
| Process vessel | Show a generic vessel with editable nozzle and contents labels. |
| Floor-plan room | Define a labeled room with dimensions and door openings. |
| Wall segment | Draw a resizable wall with configurable thickness and connected corners. |
| Door | Show opening direction and swing arc in a floor plan. |
| Window | Show width and wall placement in a floor plan. |
| Staircase | Show direction, landing, and number of steps. |
| Elevator | Mark a lift shaft, doors, and served floors. |
| Desk or workstation | Place desks and equipment with alignment and rotation. |
| CCTV camera | Show field-of-view cone, direction, and camera identifier. |
| Badge reader | Mark a controlled entrance and its access direction. |
| HVAC unit | Show air handling, supply/return ports, and zone coverage. |
| Sprinkler head | Mark fire suppression coverage and head type. |
| Fire extinguisher | Place a safety asset with extinguisher class and ID. |
| Emergency exit | Mark an exit point and evacuation direction. |
| Accessible route | Show a route with width and slope annotations. |
| Parking bay | Mark vehicle spaces, accessible spaces, and lane direction. |
| Loading bay | Mark a loading area with vehicle approach and dock details. |

### Data platform, AI, and observability

| Component | Use and behavior |
| --- | --- |
| Dashboard panel | Group charts, filters, and KPI elements under one dashboard title. |
| Time-series plot | Show metrics or sensor values across a shared time axis. |
| Log stream | Show structured log producers, storage, and search consumers. |
| Trace span | Represent one timed operation nested in a distributed trace. |
| Service-level objective | Record a service indicator, target, and measurement window. |
| Error budget | Show the remaining allowed failure against an SLO. |
| Incident card | Capture impact, timeline, mitigation, and follow-up links. |
| Alert rule | Show a metric/log condition, threshold, duration, and notification target. |
| Event timeline | Place events and decisions on a shared horizontal time axis. |
| ETL source | Identify an upstream batch or streaming data source. |
| Stream processor | Show a stateful or stateless streaming transformation. |
| Feature store | Show offline/online feature data and model consumers. |
| Model training job | Show input dataset, compute, model artifact, and evaluation output. |
| Model inference endpoint | Show deployed model input/output and callers. |
| Model registry | Track model versions, approvals, and deployment status. |
| AI agent | Show an agent, its instructions, tools, memory, and handoff connectors. |
| Retrieval pipeline | Connect document source, chunking, embedding, vector retrieval, and generation. |
| Prompt template | Show a versioned prompt input with variable placeholders. |
| Guardrail check | Show safety or policy evaluation before or after model output. |
| Human review gate | Route an AI or automated output to a person for approval. |
| Experiment variant | Compare alternative treatments or model configurations. |
| Evaluation dataset | Show test cases, expected outcomes, and evaluation metrics. |

## How the component system should work

The reliable way to reach a large catalog is to expand the shared model and library metadata rather than clone rendering code:

1. **Searchable, categorized registry.** Every entry needs a stable kind, display name, short use description, aliases/tags, category, default size, and supported platforms.
2. **Shared geometry.** Reuse existing native shapes, paths, text, and groups. A special silhouette should define one path used by canvas drawing, selection bounds, hit testing, resize handles, and export.
3. **Semantic ports and connectors.** Define connection points on components; allow named ports, direction, and data type. Keep the visual connector separate from its semantics so connector labels and endpoints remain editable.
4. **Properties that matter.** Add compact typed fields only when they improve modeling: for example, a port number, BPMN trigger, database key, circuit value, date, risk score, or deployment strategy.
5. **Resize rules per family.** Frames and tables resize their layout; icons preserve aspect ratio; line-like symbols preserve stroke width; text-bearing cards wrap and recalculate layout. Avoid scaling text or stroke as a side effect of changing a component's bounds.
6. **Reusable presets.** Expose common variants as palette entries, while storing the same component family plus configuration in the document. This limits renderers and keeps updates manageable.
7. **Portable persistence.** Save kind, properties, paths/asset IDs, and relationships in .sketch; use versioned migrations and preserve unknown kinds as editable fallback shapes.
8. **Importable libraries.** Support local JSON/SVG library packs with metadata, preview, tags, origin/license fields, and validation. Keep provider packs versioned and optional.
9. **Platform-friendly browsing.** Search, favorites, recents, category collapse, and compact mobile panels keep a large library usable without loading every thumbnail at once.

Custom libraries are a proven diagramming pattern: draw.io allows libraries containing reusable shapes, images, groups, and even complete diagrams. This supports a distinction between built-in generic components and optional or user-authored domain packs. [draw.io custom shape libraries](https://www.drawio.com/docs/manual/advanced/custom-shape-libraries/)

## Code-to-drawing support: what to add or deepen

“Code support” can mean either importing a diagram language or deriving a diagram from application/configuration source. SketchDraw already has both kinds of parsers. The strongest next improvement is broader, explicit coverage with useful round-trips and visible diagnostics.

| Priority | Format or input | What to implement | How it would work and what it is useful for |
| --- | --- | --- | --- |
| 1 | Mermaid coverage | Complete syntax coverage beyond the current flowchart, sequence, extended diagrams, pie/XY/radar charts, treemap, packet fields, and architecture subset. | Parse each family into typed nodes, edges, frames, chart data, and layout hints. Preserve source metadata so edits can write back to the same Mermaid family. Mermaid officially documents many diagram families, including sequence, class, ER, state, Gantt, architecture, packet, requirement, and Kanban. [Syntax index](https://mermaid.js.org/intro/syntax-reference.html), [examples](https://mermaid.js.org/syntax/all-examples.html) |
| 2 | PlantUML coverage | Add sequence, activity, state, use-case, component, deployment, timing, mind map, WBS/Gantt, network, JSON/YAML, and ArchiMate subsets. | Make format support explicit per syntax construct. Parse to an intermediate model; report unsupported lines with source locations. PlantUML lists these UML and non-UML families, but full-language parity would be a large project. [PlantUML supported diagrams](https://plantuml.com/) |
| 3 | D2 advanced syntax | Add SQL tables, UML classes, basic sequence diagrams, icon references, common shapes, nested containers, documented near positioning, layout direction, and grid spacing. | Parse editable structures and styles into native shapes/cards/connectors; retain D2 IDs and source attributes for export/reimport. Use near positions as hints; D2's documented syntax has no `far` placement attribute. Icon URLs are retained without fetching external assets. [SQL tables](https://d2lang.com/tour/sql-tables/), [UML classes](https://d2lang.com/tour/uml-classes/), [sequence diagrams](https://d2lang.com/tour/sequence-diagrams/), [icons](https://d2lang.com/tour/icons/), [styles](https://d2lang.com/tour/style/), [positions](https://d2lang.com/tour/positions/), [layouts](https://d2lang.com/tour/layouts/), [grid spacing](https://d2lang.com/tour/grid-diagrams) |
| 4 | Graphviz DOT depth | Add subgraphs/clusters, rank groups, same-rank constraints, record ports, node/edge defaults, HTML labels, more node shapes, arrowheads, and supported layout attributes. | Extend the current DOT subset in stages and show a loss report on export. The DOT language defines graph, node, edge, subgraph, cluster, and attribute statements; layout depends on the chosen Graphviz engine. [DOT language](https://graphviz.org/doc/info/lang.html) |
| 5 | BPMN 2.0 XML | Import/export BPMN process and collaboration models, events, gateways, tasks, pools/lanes, messages, data, and diagram interchange coordinates. | Map BPMN semantic elements separately from BPMN DI positions. Keep unsupported extensions and styles in source metadata and show a compatibility report. BPMN 2.0 includes an XML interchange schema and a diagram interchange package. [OMG BPMN specification](https://www.omg.org/spec/BPMN/), [BPMN DI](https://www.omg.org/spec/BPMN/2.0/PDF/) |
| 6 | Structurizr DSL / C4 | Import and export system landscape, context, container, component, dynamic, deployment, and relationship views. | Maintain reusable model entities across multiple diagrams; generate a selected view and keep C4 element types and tags on native shapes. C4's core static levels are context, containers, components, and code, with supporting landscape, dynamic, and deployment views. [C4 diagrams](https://c4model.com/diagrams) |
| 7 | SQL DDL round-tripping | Expand dialect support for PostgreSQL, MySQL/MariaDB, SQLite, and SQL Server, including schemas, keys, indexes, views, enums, and constraints. | Parse DDL into schema-table cards and relationship connectors. Edit table cards and regenerate DDL while reporting dialect-specific losses. Existing SQL editing is already present, so the improvement is broader dialect and object coverage. |
| 8 | API and event contracts | Add AsyncAPI, GraphQL SDL, Protocol Buffers, Avro, Prisma, and DBML. | Turn operations, messages, schema types, and references into editable API/data-model diagrams. Keep source IDs, field order, required/optional state, and descriptions. |
| 9 | Infrastructure as code | Deepen Terraform/CloudFormation/ARM/Bicep and add Pulumi, OpenTofu plan/state, Helm, Kustomize, and Dockerfile imports. | Extract resources, modules, parent-child boundaries, references, and deployment status. Use provider icon packs only when matched to known resource types; unknown resources remain generic typed nodes. This produces diagrams only; it must not execute, deploy, or contact cloud accounts. |
| 10 | Kubernetes model depth | Add CRDs, Gateway API, NetworkPolicy, RBAC, HPA, storage classes, volumes, service accounts, and Helm-rendered manifests. | Group objects by namespace, cluster, and workload; connect selectors, references, ingress, and volume mounts. Kubernetes models workloads, networking, storage, configuration, security, and policies as distinct resource families. [Kubernetes concepts](https://kubernetes.io/docs/concepts/) |
| 11 | Source-code architecture extraction | Generate UML class, package/module dependency, and call graphs for TypeScript/JavaScript, Python, Java, and C#. | Use language parsers or compiler APIs, never regex-only scraping. Run locally, let users select folders/files, show what files will be analyzed, and keep source paths optional in saved documents. |
| 12 | OpenAPI depth | Add OpenAPI 3.1 callbacks, webhooks, security schemes, tags, reusable parameters, schemas, and server/deployment views. | Give each operation a route node, connect request/response schemas, and group by tag or service. Report references that could not be resolved. OpenAPI is already accepted; this adds semantic coverage and view choices. |
| 13 | Data pipeline code | Add dbt project/manifest, SQL transformation lineage, Airflow DAG, and workflow definitions. | Convert models, sources, tasks, schedules, and dependencies to a pipeline graph; separate configured dependencies from inferred lineage. |
| 14 | Diagram interchange | Add draw.io XML, Excalidraw JSON, Structurizr workspace, and documented JSON component libraries. | Preserve editable native elements and relationships where possible; import unsupported shapes as grouped SVG or fallback geometry with alt text. draw.io supports importing many formats, including Mermaid and SQL, and custom libraries can be reused. [draw.io import formats](https://www.drawio.com/docs/manual/import/import-formats/) |
| 15 | Source mapping and diagnostics | Add line/column errors, warnings for partial conversions, unsupported-feature summaries, and source-to-shape selection. | Selecting a generated shape highlights its source; selecting a source line highlights the associated shape and relationships. This makes larger parser support reviewable and prevents silent loss. |
| 16 | Round-trip contract | Define per-format capabilities: import, edit, export, exact round-trip, partial round-trip, and preserved source metadata. | Show a short loss summary before export and retain source text for constructs SketchDraw does not yet model. Do not claim a format is fully supported just because it can be rendered once. |

## Implementation tracking

Updated 1 November 2026. A family is marked complete only after its full stated scope is implemented and checked. A palette entry or generic editable card does not count as completion by itself. The 198 proposal entries currently in the palette are a starting catalog; family-specific editing, behavior, and checks are tracked below. All six component families (6/6) are complete. Seven of 16 code-to-drawing items are complete (7/16); the remaining nine are still open. Deeper BPMN XML interchange is tracked separately as item 5.

### Component family implementation status

| Family | Status | Evidence / remaining work before completion |
| --- | --- | --- |
| Systems engineering and advanced UML | Complete | All 38 entries now have purpose-specific editable fields and canvas/SVG layouts; typed SysML/UML connectors expose editable relationship details, interface ports accept only supported relationship types, and resize limits preserve usable geometry. Fixtures cover every field in both renderer paths, relationships, port validation, and `.sketch` save/reopen. `npm run test:diagrams`, `npm run typecheck`, `npm run build`, and `npm run test:canvas` passed. |
| BPMN and decision modelling | Complete | All 30 entries now have purpose-specific fields; all 24 nodes draw their editable data on canvas and SVG, and all 6 connectors retain typed, editable relationship details. BPMN event markers, subprocesses, choreography/conversation, messages, data objects, and collections have notation-specific layouts; event and DMN ports align with their visible symbols. DMN decisions, services, input/knowledge relationships, and decision tables have directional validation. Advanced BPMN events and subprocess/choreography nodes participate in sequence simulation. Fixtures cover fields, both renderers, ports, relationship direction, simulation, resize minima, and `.sketch` save/reopen. `npm run test:diagrams`, `npm run typecheck`, `npm run build`, and `npm run test:canvas` passed. Deeper BPMN XML interchange remains tracked separately in code-to-drawing item 5. |
| Database, data structures, and schemas | Complete | All 34 entries now have purpose-specific editable fields; 33 non-connector nodes render those values in dedicated canvas and SVG layouts for document, graph, vector, event, schema, relational, warehouse, contract, classification, and quality models. Table rows expose aligned connector ports, and the directed lineage connector carries editable transformation metadata. Fixtures cover field editing, both renderers, row ports, resize minima, connector semantics, and `.sketch` save/reopen. `npm run test:diagrams`, `npm run typecheck`, `npm run build`, and `npm run test:canvas` passed. |
| Software architecture and integration patterns | Complete | All 33 proposal items now have architecture-specific editable fields and dedicated canvas/SVG layouts, including the previously missing Scheduler, Application service, and Data object entries. Covers clients, workers and schedules; API/RPC/webhook contracts; event producers, consumers, topics and partitions; sagas, outbox, CDC, service-mesh sidecars, circuit breakers, adapters and BFFs; domain boundaries/entities/value objects/events; and application, business, data and technology architecture. Fixtures cover every field in both renderers, component geometry and resize bounds, bound typed dependency connectors, and `.sketch` save/reopen. `npm run test:diagrams`, `npm run typecheck`, `npm run build`, and `npm run test:canvas` passed. |
| Visual planning and decision tools | Complete | All 39 entries now have purpose-specific editable fields; the nodes render dedicated Canvas and SVG layouts for PESTLE/SWOT, assumptions and stakeholders, scoring matrices, RACI and decision trees, customer journeys, empathy maps and blueprints, event-storming, impact/story mapping, roadmaps, work breakdown structures, milestones, OKRs, and critical-path tasks. RICE, ICE, weighted decisions, key-result progress, and linked FS/SS/FF/SF dependency float calculate from editable values. Fixtures cover every field in both renderers, scores, dependency semantics, CPM, resize bounds, and all components' `.sketch` save/reopen. `npm run test:diagrams`, `npm run typecheck`, `npm run build`, and `npm run test:canvas` passed.
| Wireframing and UI planning | Complete | All 24 entries now have purpose-specific editable fields and dedicated Canvas/SVG layouts for responsive screen and device frames, browser and desktop windows, navigation, drawers, sheets, tooltips, popovers, command palettes, empty/loading/error states, forms, file drop, filters, search results, notifications, code editors, validation summaries, breakpoints, and focus rings. Device and window frames offer three viewport presets each; starting dimensions match usable resize minima. Fixtures verify every field in both renderers, all presets, minimum sizes, and `.sketch` save/reopen. `npm run test:diagrams`, `npm run typecheck`, `npm run build`, and `npm run test:canvas` passed. |

### Code-to-drawing work still to complete

Each item remains incomplete until the documented format subset is implemented, its supported and unsupported behavior is explicit, and fixtures verify the import/export or round-trip claims. Existing partial support is a starting point, not a completion claim.

| Item | Current state | Remaining work before completion |
| --- | --- | --- |
| 1. Mermaid coverage | **Complete for the documented editable subsets.** All 31 families in Mermaid 12.2’s syntax reference are detected and generate editable canvas models: flowchart, swimlane, sequence, class, state, ER, user journey, Gantt, pie, quadrant, requirement, use case, GitGraph, C4, mind map, timeline, ZenUML, Sankey, XY chart, block, packet, Kanban, architecture, radar, Event Modeling, treemap, Venn, Ishikawa, Wardley, Cynefin, and TreeView. Each family has a live supported-syntax and known-limits summary; source remains attached to generated groups. The new ZenUML subset handles annotated/aliased participants, calls and assignments, async messages, creation, returns, comments, nested calls, loops, alternatives, optional/parallel blocks, try/catch/finally, and break, with source edits for titles, participant aliases, messages, and conditions. Mermaid flowchart and sequence syntax errors include line and column details; family import fixtures verify family detection, layout, export/reimport, metadata persistence, supported constructs, and explicit unsupported cases. Known losses are stated per family: canvas coordinates are not Mermaid source data, some styling/directives are outside the editable subsets, and Venn overlap geometry is approximate. Checked with `npm run test:diagrams`, `npm run typecheck`, and `npm run build` on 1 November 2026. | None for this item’s defined subset-coverage scope. Mermaid language support remains intentionally family-specific; the listed limits are shown in the editor help and unsupported constructs are not claimed as editable. |
| 2. PlantUML coverage | **Complete for the documented editable subsets.** Alongside existing class/object and sequence support, added activity (actions, decisions, branches, loops, forks/joins, partitions), state (initial/final states, transitions, labels, simple composites), use case (actors, use cases, boundaries, links), component/deployment declarations and relationships, timing samples, mind maps, WBS, Gantt tasks/dates/durations/milestones/dependencies, nwdiag networks/hosts/groups, JSON/YAML trees, and common ArchiMate element and relationship macros. Mapped editable labels and relationship text retain source spans; text-label edits patch the original source. The editor reports family-specific supported syntax and known losses, and unsupported constructs include line/column locations. Fixtures cover all 13 added families, export/reimport, source-label editing, sketch metadata/source persistence, and unsupported syntax. Verified with diagram fixtures, typecheck, and production build on 1 November 2026. | No remaining work for the PlantUML subsets specified here. Canvas positions and added/deleted objects are not serialized; scalar JSON/YAML values and source constructs outside the stated subsets remain in retained source but are not editable model data. |
| 3. D2 advanced syntax | **Complete for the documented editable subset.** Imports D2 SQL tables into schema cards (including keys, uniqueness, and field-linked references), UML classes into editable class components, basic sequence participants/messages, nested containers, common shapes, supported flat and nested styles, icon URL metadata, near hints, diagram direction, grid rows/columns/gaps, and padding. D2 IDs, labels, modeled styles, and layout hints survive `.sketch` normalization and D2 export/reimport. Unsupported syntax reports line and column; fixtures cover import, editable fields, style/ID/layout round trips, sequence messages, and `.sketch` normalization. Checked with `npm run test:diagrams`, `npm run typecheck`, and `npm run build` on 1 November 2026. | No remaining work for the stated subset. Icon URLs are preserved as metadata and accessible text but are not fetched or rendered. Object-near placement and engine-specific layout are approximated. D2 has no documented `far` attribute; sequence fragments and unlisted style properties remain unsupported and are rejected rather than silently dropped. |
| 4. Graphviz DOT depth | **Complete for the documented editable subset.** Imports nested clusters as editable groups; same/min/max/source/sink rank groups; record and HTML-table ports; scoped node and edge defaults; common node shapes; HTML-like labels as editable plain text; edge directions and arrowheads; node/edge color and stroke styles; and `rankdir`, `nodesep`, `ranksep`, and `ranksep="… equally"`. Export preserves cluster nesting, rank groups, record ports, IDs, styles, arrows, and supported layout settings. Unsupported shapes and reduced HTML formatting have explicit fallback descriptions and export-loss messages. Fixtures verify nested clusters, same-rank alignment, defaults versus explicit node attributes, HTML label text and ports, connector endpoint bindings and arrowheads, layout values, loss messages, and export/reimport. Checked with `npm run test:diagrams`, `npm run typecheck`, and `npm run build` on 1 November 2026. | No remaining work for this defined subset. HTML-like label formatting and Graphviz’s exact layout are not preserved; canvas coordinates and manual connector routes are recalculated by Graphviz. Only the listed layout and style attributes are modeled. |
| 5. BPMN 2.0 XML | Partial BPMN semantic XML import/export exists. | Complete event, task, gateway, collaboration, data, and BPMN DI coordinate/style coverage; preserve extensions and provide compatibility diagnostics. |
| 6. Structurizr DSL / C4 | A C4 subset and relationship round-trip exist. | Support the listed view types over reusable shared entities, preserve element types/tags, and verify exported views and model identity. |
| 7. SQL DDL round-tripping | **Complete for the documented four-dialect subset.** Imports PostgreSQL, MySQL/MariaDB, SQLite, and SQL Server qualified tables, common primary/foreign/unique/check constraints (including FK update/delete actions), composite keys, basic and expression indexes (including order, PostgreSQL access method, and partial predicates), ordinary views with retained queries, PostgreSQL named enums, and MySQL inline enums. Schema cards distinguish tables, views, and enum types and preserve view queries/enum values through `.sketch` normalization and Draft 2020-12 JSON Schema extensions. SQL export offers PostgreSQL, MySQL, MariaDB, SQLite, and SQL Server; enum values remain native for PostgreSQL/MySQL/MariaDB or become checked text-like columns for SQLite/SQL Server. Dialect losses appear before export. Fixtures cover all four DDL inputs, import/export/reimport, SQL Server `GO` separators, qualified names, constraints/actions, indexes, composite keys, views, enum conversions, JSON Schema metadata, and `.sketch` normalization. Checked with `npm run test:diagrams`, `npm run typecheck`, and `npm run build` on 1 November 2026. | No remaining work for this item’s documented subset. The parser is not a complete SQL grammar. It reports known losses for defaults, generated/identity clauses, collations, materialized views, triggers, routines, deferrability, some advanced index options, and unsupported enum/schema conversions; standalone enums in non-PostgreSQL targets are represented by comments while references are translated when possible. |
| 8. API and event contracts | GraphQL, Protocol Buffers, Avro, Prisma, DBML, and AsyncAPI import foundations exist. | Complete the listed contract semantics, edits, ordering, required/optional state, descriptions, references, and applicable exports/round-trip fixtures. |
| 9. Infrastructure as code | Terraform source and plan/state imports exist. | Add CloudFormation, ARM/Bicep, Pulumi, OpenTofu, Helm, Kustomize, and Dockerfile inputs with typed resources, nesting, and dependency references. |
| 10. Kubernetes model depth | Common manifests and some references import. | Add the listed CRDs, Gateway API, NetworkPolicy, RBAC, HPA, storage, volumes, service accounts, and Helm manifests; verify grouping and relationships. |
| 11. Source-code architecture extraction | Not complete. | Add local parser-backed TypeScript/JavaScript, Python, Java, and C# extraction for UML classes, package/module dependencies, and call graphs, with file selection and mapping. |
| 12. OpenAPI depth | OpenAPI operations and several advanced references import. | Complete OpenAPI 3.1 callbacks, webhooks, security, tags, reusable parameters/schemas, and server views; report unresolved references. |
| 13. Data pipeline code | **Complete for the documented static-import subsets.** Alongside dbt manifest lineage, SQL imports infer table/view lineage from supported CREATE, INSERT, MERGE, SELECT, CTE, FROM, and JOIN forms. Airflow imports literal DAG/task declarations, TaskGroups, @task calls, and configured dependency operators/helpers; TaskFlow argument relationships are marked inferred. GitHub Actions YAML imports workflow triggers, jobs, runners, matrices, steps, and configured `needs` edges. The importer never executes SQL or Python. Fixtures verify SQL source-to-target links and CTE handling, Airflow configured versus inferred edges and TaskGroups, GitHub Actions jobs/needs/matrices, malformed or unsupported input, and generic YAML fallback. Checked with `npm run test:diagrams`, `npm run typecheck`, and `npm run build` on 1 November 2026. | No remaining work for these documented subsets. SQL lineage is a static heuristic, not a full SQL grammar; dynamic Airflow DAG generation and runtime behavior are not evaluated; GitHub Actions step internals are summarized rather than executed. |
| 14. Diagram interchange | **Complete for the documented editable subsets.** draw.io imports/exports editable shapes, labels, images, connectors, and nested groups, and reports kept/simplified/skipped cells; unsupported custom shapes become editable rectangles with their source shape identified in alt text, which now survives SketchDraw export/reimport. Excalidraw imports/exports common primitives, text, freehand, groups, bound connectors, editable block arrows/SVG path subsets, and embedded images; unsupported elements or invalid/unavailable image/path content with valid bounds become editable rectangles with preserved explanatory alt text. Structurizr workspace JSON imports/exports people, C4 systems/containers/components, deployment nodes/instances, relationships, stable IDs, tags, descriptions, properties, and a generated system-landscape view; metadata survives `.sketch` save/reopen. The portable JSON component library documents stencil and component-master data, accepts v1 libraries, and exports v2 with parameterized stencils, variants, states, and connection points. Fixtures cover import/export/reimport, fallback descriptions, nested group bounds, Structurizr model identity and metadata through `.sketch`, and library versioning, validation, and size limits. Checked with `npm run test:diagrams`, `npm run test:canvas` (755 checks), `npm run typecheck`, and `npm run build` on 1 November 2026. | No remaining work for these stated interchange subsets. Full draw.io shape/style fidelity and all Excalidraw element types are not promised; unsupported elements without usable geometry may be skipped. Structurizr view coordinates, view styling, and documentation are regenerated or omitted; the workspace model is preserved. The stencil format preserves supported SketchDraw element data and ignores unknown fields. |
| 15. Source mapping and diagnostics | Some parser source metadata and unsupported-line errors exist. | Standardize line/column diagnostics, partial-conversion warnings, unsupported-feature summaries, source-to-shape links, and bidirectional selection. |
| 16. Round-trip contract | Per-format capabilities are not fully surfaced. | Define import/edit/export fidelity per format, retain original source for unmodeled constructs, and show losses before export with fixtures for each claim. |

### Suggested staged implementation

| Stage | Scope | Outcome |
| --- | --- | --- |
| A — Reach the catalog target | Add 178 well-chosen entries from the candidate tables, first choosing generic high-use families: SysML requirements, DMN, missing software integration patterns, data schemas, network/security, electrical symbols, and planning methods. | At least 500 library palette components while keeping renderer families small. |
| B — Complete diagram-as-code basics | Improve Mermaid, PlantUML, D2, and DOT coverage; add diagnostics and capability summaries. | More existing text workflows become editable and predictable. |
| C — Standard interchange | BPMN 2.0 XML, Structurizr/C4, draw.io XML, and richer SQL/API schemas. | Better transfer to other diagram tools and durable model workflows. |
| D — Source-derived diagrams | Language-aware code extraction, pipeline lineage, and more IaC/Kubernetes coverage. | Use code and deployment definitions as diagram inputs while keeping all analysis local. |
| E — Optional asset packs | Versioned AWS/Azure/GCP, Kubernetes/CNCF, network vendor, and industry symbol libraries. | Large provider catalogs stay updateable and optional instead of bloating the base app. |

## Research basis and design implications

- **Diagram libraries are broad, but semantic behavior matters.** draw.io's custom libraries include reusable shapes, images, groups, and full diagrams. SketchDraw can support a high count with searchable, versioned libraries rather than one-off tool logic. [Custom shape libraries](https://www.drawio.com/docs/manual/advanced/custom-shape-libraries/)
- **Diagram languages cover different audiences.** Mermaid documents flow, interaction, structure, state, requirements, architecture, planning, and data visualization diagrams. PlantUML covers UML as well as mind maps, WBS/Gantt, network, JSON/YAML, regex, and other notations. [Mermaid syntax](https://mermaid.js.org/intro/syntax-reference.html), [PlantUML](https://plantuml.com/)
- **Formal models have exchange semantics.** OMG's UML, SysML, and BPMN pages publish normative specifications and machine-readable models or schemas. Their model relationships should be represented explicitly if SketchDraw later adds standards-based import/export. [UML 2.5.1](https://www.omg.org/spec/UML/2.5.1/PDF), [SysML 1.6](https://www.omg.org/spec/SysML/1.6/), [BPMN 2.0.2](https://www.omg.org/spec/BPMN/)
- **C4 is a hierarchy of zoom levels.** System context and container views explain architecture at different levels; components and code can be added when they help the audience. This argues for linked views from shared model data, not duplicate disconnected drawings. [C4 diagrams](https://c4model.com/diagrams), [C4 introduction](https://c4model.com/introduction)
- **Cloud and Kubernetes need regular catalog maintenance.** Official cloud icon sets change over time; Kubernetes itself separates cluster architecture, workloads, networking, storage, security, and configuration. Use versioned optional icon packs and stable generic shapes for long-lived documents. [AWS icons](https://aws.amazon.com/architecture/icons/), [Azure icons](https://learn.microsoft.com/en-us/azure/architecture/icons/), [Google Cloud icons](https://cloud.google.com/icons), [Kubernetes concepts](https://kubernetes.io/docs/concepts/)
- **Text conversion should show its limits.** draw.io documents imports from Mermaid, SQL, and CSV; Mermaid and PlantUML have multiple syntax families. SketchDraw should offer explicit supported subsets, explain lossy conversion, and preserve original source where editable semantics are missing. [draw.io import formats](https://www.drawio.com/docs/manual/import/import-formats/), [Mermaid syntax reference](https://mermaid.js.org/intro/syntax-reference.html)

## Sources

- [Mermaid syntax reference](https://mermaid.js.org/intro/syntax-reference.html) and [all diagram examples](https://mermaid.js.org/syntax/all-examples.html) Venn and Ishikawa beta syntax: [Venn](https://mermaid.js.org/syntax/venn.html), [Ishikawa](https://mermaid.js.org/syntax/ishikawa.html)
- [PlantUML supported diagram types](https://plantuml.com/) and [language specification sitemap](https://plantuml.com/sitemap-language-specification)
- [Graphviz DOT language](https://graphviz.org/doc/info/lang.html)
- [D2 SQL table shapes](https://d2lang.com/tour/sql-tables/)
- [OMG UML 2.5.1 specification](https://www.omg.org/spec/UML/2.5.1/PDF), [SysML 1.6 specification](https://www.omg.org/spec/SysML/1.6/), and [BPMN 2.0.2 specification](https://www.omg.org/spec/BPMN/)
- [C4 model diagrams](https://c4model.com/diagrams)
- [Kubernetes concepts](https://kubernetes.io/docs/concepts/)
- [draw.io custom shape libraries](https://www.drawio.com/docs/manual/advanced/custom-shape-libraries/) and [import formats](https://www.drawio.com/docs/manual/import/import-formats/)
- [AWS architecture icons](https://aws.amazon.com/architecture/icons/), [Azure architecture icons](https://learn.microsoft.com/en-us/azure/architecture/icons/), and [Google Cloud product icons](https://cloud.google.com/icons)

