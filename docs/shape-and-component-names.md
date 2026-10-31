# SketchDraw shape and component catalog

For local-coordinate paths, default component geometry, editable fields, rendered SVG, and connection points, see [shape-component-geometry.json](shape-component-geometry.json). Regenerate it after changing a shape or component definition with `npm run reference:shapes`.

## Canvas elements

- Freehand stroke — Pen or stylus marks drawn directly on the canvas.
- Shape — Geometric or flowchart symbol with an optional label.
- Text — Editable text placed on the canvas.
- Image — Embedded raster image or imported artwork.
- Schema table — Database table with fields, keys, indexes, and constraints.
- Group — Objects selected and managed together.
- Frame — Named boundary for organizing a screen or diagram.
- Container — Parent object that organizes child elements.
- Swimlane — Container divided into lanes for roles or stages.
- Note — Text card for notes or Markdown.
- Sticky note — Compact colored note card.
- Checklist — Note with checkable items.

## Additional shape element types

- Line — Connector between two points with straight, elbow, or curved routing.
- Arrow — Directional connector with configurable route and arrowheads.
- SVG path — Editable vector path with fill and stroke.

## Basic shapes

- Rectangle — Four-sided box for an object or label.
- Circle — Round shape for a node or marker.
- Diamond — Diamond symbol for a decision or relationship.
- Triangle — Three-sided shape or direction marker.

## Flowchart shapes

- Process — Action or processing step.
- Terminator — Start or end of a process.
- Decision — Branching point based on a condition.
- Input / output — Data entering or leaving a process.
- Document — Document created or used by a process.
- Multiple documents — Stack of documents.
- Database — Database or stored information.
- Predefined process — Subprocess defined elsewhere.
- Internal storage — Data held within a process or system.
- Preparation — Setup or initialization step.
- Manual input — Information entered by a person.
- Manual operation — Step performed manually.
- On-page connector — Flow continuation elsewhere on the same page.
- Off-page connector — Flow continuation on another page.
- Delay — Waiting period in a process.
- Stored data — Persisted data used by a process.
- Display — Information shown to a user.
- Merge — Combines paths into one flow.
- Extract — Selects records from a data set.
- Collate — Combines items into sequence.
- Sort — Orders items by a key.
- Summing junction — Adds incoming values.
- OR junction — Logical OR junction.
- Loop limit — Boundary or limit for a loop.
- Loop start — Marks the beginning of a repeated flow.
- Loop end — Marks the end of a repeated flow.
- Alternate process — Alternative way to perform a process.
- Card — Card-shaped data symbol.
- Punched tape — Sequential data stored on tape.
- Sequential data — Data accessed in sequence.
- Direct access storage — Data stored for direct access.

## General shapes

- Cloud — Cloud-shaped symbol or boundary.
- Star — Star-shaped marker.
- Lightning — Lightning bolt symbol.
- Heart — Heart-shaped symbol.
- Callout — Speech callout for an annotation.
- Gear — Gear-shaped symbol.
- Hexagon — Six-sided shape.
- Parallelogram — Slanted four-sided shape.
- Trapezoid — Four-sided shape with a narrower edge.
- Pentagon — Five-sided shape.
- Octagon — Eight-sided shape.
- Chevron — V-shaped direction marker.
- Cross — Cross-shaped marker.
- Folder — Folder symbol.
- Note — Page-corner note shape.
- Cube — Isometric cube symbol.
- Rounded rectangle — Box with rounded corners.
- Shield — Shield-shaped symbol.
- Right arrow — Arrow pointing right.
- Left arrow — Arrow pointing left.
- Double arrow — Arrow pointing in both directions.
- Up arrow — Arrow pointing up.
- Down arrow — Arrow pointing down.
- Ring — Circular ring shape.
- Pie slice — Wedge-shaped segment of a circle.
- Wave — Wavy banner shape.
- Banner — Ribbon-shaped label.
- Teardrop — Teardrop-shaped marker.
- Funnel — Tapered shape for filtering or conversion.

## Connector names

### Connector routes

- Straight — Direct path between two points.
- Elbow — Path made of right-angle segments.
- Curve — Smooth path with editable bends.
- Forked — One trunk that splits to two destinations.
- Loop — Path that curves back to its source.
- Jagged — Path made of sharp angled segments.

### Arrowheads

- None — No endpoint marker.
- Open — Unfilled arrowhead.
- Solid — Filled arrowhead.
- Hollow — Outlined arrowhead.
- Thick — Broad arrowhead.
- Dot — Circular endpoint marker.
- Diamond — Filled diamond endpoint.
- Open diamond — Outlined diamond endpoint.
- Bar — Bar-shaped endpoint marker.
- Crow — Crow-foot cardinality marker.

### Stroke styles

- Solid — Continuous line.
- Dashed — Line with long gaps.
- Dotted — Line made of dots.
- Double — Two parallel lines.

### Relationship types

- Association — General structural relationship.
- Dependency — One element depends on another.
- Data flow — Data moves between elements.
- Inheritance — A type derives from another type.
- Aggregation — Whole and part relationship with independent parts.
- Composition — Whole and part relationship with owned parts.
- Sequence — Ordered interaction between participants.
- Network — Connection between network nodes.
- Other — Unclassified relationship.

### BPMN connectors

- Sequence flow — Order of activities within a process.
- Message flow — Communication between process participants.
- Data association — Links data to an activity or event.

## Modeling components

### General | Layout

- Frame — Resizable titled boundary for any diagram
- Swimlane — Resizable lanes for organizing responsibilities or stages

### UML | Classes & sequence

- Class card — Name, attributes, and methods compartments
- Lifeline — Participant header and dashed lifeline
- Activation bar — Sequence activation marker
- Sync message — Solid synchronous message arrow
- Async message — Open asynchronous message arrow
- Interface — Interface with operations compartment
- Enumeration — Enumeration classifier with literal compartment

### UML | Objects

- Object instance — Named instance with classifier, state, and slot values

### UML | State machines

- State — Rounded UML state with room for entry or exit actions
- Initial state — Filled initial pseudostate
- Final state — Bullseye final pseudostate
- Fork — Fork bar for concurrent state transitions
- Join — Join bar for synchronizing concurrent transitions

### UML | Activity diagrams

- Activity initial node — Control-flow start marker for an activity
- Action — Executable activity step with inputs and outputs
- Decision / merge — Decision or merge node with an editable condition and guards
- Activity final node — Bullseye marker that ends the whole activity

### UML | Structure

- Component — Component classifier with UML component tabs
- Node — Three-dimensional deployment node
- Artifact — Folded-corner deployment artifact

### UML | Relationships

- Inheritance — Straight connector with a hollow arrowhead
- Realization — Straight dashed connector with a hollow arrowhead
- Aggregation — Straight connector with an open diamond endpoint
- Composition — Straight connector with a filled diamond endpoint
- Association — Structural relationship between classifiers
- Dependency — Dashed dependency arrow between classifiers

### UML | Use cases

- Include — Dashed include relationship between use cases
- Extend — Dashed extension relationship between use cases
- Actor — Use case actor with an editable role and goal
- Use case — Use case ellipse with an outcome
- Package — Package boundary for grouped model elements

### ER | Entities & relations

- Table schema card — Table with key, field, and type rows
- Entity — Editable entity rectangle
- Weak entity — Entity with a double boundary
- Associative entity — Entity marked with an embedded relationship symbol
- Relationship — Editable relationship diamond
- Identifying relationship — Relationship with a double boundary
- One to many — Straight connector with one and crow's foot endpoints
- Many to many — Straight connector with crow's foot endpoints

### Database | Relational objects

- View — Saved query with source tables and refresh behavior
- Index — Index definition with method, ordered columns, and predicate

### Database | Programmable objects

- Stored procedure — Database routine with signature, transaction behavior, and side effects

### ER | Attributes

- Attribute — Editable attribute oval
- Composite attribute — Parent attribute with two editable child attributes
- Key attribute — Underlined primary key attribute
- Partial key attribute — Dashed, underlined discriminator for a weak entity
- Multivalued attribute — Attribute with a double boundary
- Derived attribute — Dashed attribute oval

### ER | Relationships

- One to one — Straight connector with one markers at both ends
- Many to one — Straight connector with a crow's foot and one marker

### Architecture | C4 boundaries

- System boundary — C4 system context enclosure
- Container boundary — C4 container enclosure
- Component boundary — C4 component enclosure

### Architecture | C4 people & systems

- Software system — System that delivers a capability to its users and integrates with other systems
- Person — Person or user interacting with a software system
- External system — External software system or integration

### Architecture | C4 elements

- C4 container — Deployable application or data store with responsibility and technology
- C4 component — Module inside a container with responsibility and interface

### Architecture | Deployment

- Deployment node — Host, virtual machine, or runtime that contains deployed software
- Infrastructure node — Infrastructure that hosts deployed software, such as a load balancer or DNS service

### Architecture | Code

- Code element — Code-level class, interface, object, function, or database table

### Software | Application components

- Web client — Browser client with editable interface panels
- API endpoint — HTTP operation with method, path, request, response, and security details
- Application service — Service node with a clear module badge
- Technology service — Service with technology tag and data flow

### Software | Data components

- Database — Editable application database node

### Software | Messaging & cache

- Message queue — Queue with message slots and flow direction
- Event bus — Shared event channel with publisher and subscriber ports
- Cache — Fast key-value cache component

### Software | Connectors & boundaries

- Data flow — Directional data pipeline arrow

### Annotations & aids

- Legend — Editable key for diagram colors and object types

### Cloud | Deployment

- Cloud boundary — Provider-neutral deployment or region enclosure

### Cloud | Services

- Cloud function — Serverless function service node
- Object storage — Provider-neutral object storage component
- Managed database — Managed relational database component
- Cloud queue — Managed asynchronous message queue

### Network | Devices & zones

- Network zone — Infrastructure enclosure with connection points
- Subnet — IP subnet boundary with room for member devices

### Network | Devices

- Router — Network router with directional ports
- Switch — Ethernet switch with visible ports
- Hub — Central network hub with configurable connection ports
- Firewall — Firewall device with segmented face
- Load balancer — Traffic distributor with multiple outputs
- Server — Stacked server node
- Client device — Desktop client device
- Wireless access point — Ceiling mounted access point puck with radio and status lights
- Internet — External internet or public network cloud
- VPN tunnel — Encrypted site-to-site or client VPN path
- DNS server — Name resolution service node
- NAT gateway — Address translation between private and public networks
- Modem — Network access modem with status and radio marks
- Bridge — Layer-two bridge between network segments
- Gateway — Gateway connecting two network domains
- Printer — Shared network printer endpoint
- Workstation — User workstation on a local network

### Data visualization | Charts

- Bar chart — Compact comparison chart with sample series
- Horizontal bar chart — Rank categories with long labels
- Stacked bar chart — Compare totals and their component series
- Line chart — Trend chart with editable points and axis labels
- Area chart — Filled trend bands for comparing totals
- Scatter plot — Point cloud for comparing two measures
- Pie chart — Category proportions with an editable legend
- Doughnut chart — Category proportions with a central total
- Radar chart — Compare several profiles across shared measures
- Gauge chart — Show progress against a chosen maximum
- Funnel chart — Show stage values through a process
- Heatmap — Compare values across rows and categories
- Treemap — Compare hierarchical category sizes

### Data visualization | Metrics

- Metric card — Headline value, trend, and supporting caption

### BPMN | Events & flow

- Start event — BPMN start event with a visible trigger
- Message event — BPMN message trigger or result event
- Timer event — BPMN timer trigger event with an expression
- Error event — BPMN error event with an error code
- Signal event — BPMN signal event for broadcast process flow
- Terminate event — BPMN event that ends the current process instance
- Intermediate event — BPMN intermediate event with a named definition
- End event — BPMN end event with a business outcome
- Boundary event — Event marker with a trigger attached to a task boundary
- Exclusive gateway — BPMN exclusive decision gateway
- Parallel gateway — BPMN parallel split or join gateway
- Inclusive gateway — BPMN gateway for one or more selected paths
- Event gateway — BPMN event-based routing gateway

### BPMN | Tasks & data

- Task — BPMN activity task
- User task — Human work completed with a task or form
- Service task — Automated work performed by a service
- Script task — Automated work performed by an embedded script
- Manual task — Work performed by a person without a workflow engine
- Business rule task — Task that evaluates a business rule or decision table
- Send task — Task that sends a message to another participant
- Receive task — Task that waits for a message from another participant
- Call activity — Reusable called process or global task
- Subprocess — Collapsed BPMN subprocess with expand marker
- Data object — BPMN document data object
- Data store — Persistent data available beyond one process instance
- Text annotation — Annotation connected to a flow object
- Group artifact — Dashed grouping boundary for related process elements
- Pool / lane — BPMN participant pool with a lane divider

### Network | Security

- Proxy — Intermediary that forwards client requests to services
- Bastion host — Hardened access host at a protected network boundary

## UI components

### Forms & UI | Controls

- Button — Compact primary action button
- Slider — Range control with a movable value

### Forms & UI | Fields

- Text field — Compact labeled text input
- Select field — Compact labeled selection field
- Text area — Multi-line text input
- Search field — Search input with a search icon
- Date field — Date input with a calendar affordance
- Password field — Masked password input
- Email field — Labeled email input
- File upload — File picker field with upload affordance

### Forms & UI | Choices

- Checkbox group — Compact list of selectable options
- Radio group — Compact single-choice list
- Toggle switch — Compact settings switch

### Forms & UI | Layout

- Content card — Card with image, title, copy, and action
- App bar — Header bar with brand and account controls
- Side navigation — Navigation rail with active page
- Tab bar — Horizontal navigation tabs
- Accordion — Expandable section list wireframe
- Divider — Horizontal content separator
- Footer — Page footer with a label and links

### Forms & UI | Media

- Image placeholder — Replaceable media area for a wireframe

### Forms & UI | Feedback

- Alert banner — Inline status message with an icon
- Dialog window — Confirmation dialog with actions
- Status badge — Small status or category label
- Progress bar — Labeled completion meter
- Toast notification — Short status message with a dismiss affordance

### Forms & UI | Navigation

- Breadcrumbs — Compact hierarchical navigation trail
- Menu — Compact navigation menu
- Pagination — Page navigation with previous and next controls

### Forms & UI | Identity

- Avatar — User avatar with initials

### Forms & UI | Data

- List — Compact list with editable rows
- Data table — Simple table with headers and sample rows

## Cloud provider components

### AWS

- Amazon EC2 — Elastic compute instance
- AWS Lambda — Event driven serverless compute
- Amazon S3 — Object storage bucket
- Amazon RDS — Managed relational database
- API Gateway — Managed HTTP API entry point
- Amazon SQS — Message queue
- Amazon VPC — Virtual private cloud boundary
- CloudFront — Content delivery network
- Amazon ECS — Managed container orchestration
- Amazon EKS — Managed Kubernetes control plane
- Amazon DynamoDB — Managed key-value and document database
- Amazon SNS — Publish and subscribe notifications
- Amazon EventBridge — Event routing and integration bus
- Amazon CloudWatch — Metrics, logs, and alarms
- AWS Secrets Manager — Managed secret storage and rotation
- AWS IAM — Identity and access management
- Amazon Aurora — Managed MySQL and PostgreSQL compatible database
- Amazon Bedrock — Managed foundation model and agent platform
- AWS CloudTrail — Account activity and API audit events
- Amazon ECR — Managed container image registry
- Amazon EBS — Block storage volumes for compute instances
- Amazon ElastiCache — Managed in-memory cache
- Amazon Route 53 — DNS and domain routing
- AWS Step Functions — Visual workflow and state orchestration
- AWS Glue — Managed data integration and ETL
- Amazon Redshift — Cloud data warehouse and analytics
- Amazon Kinesis Data Streams — Real-time event stream ingestion
- AWS WAF — Web request filtering and protection
- AWS Key Management Service — Managed cryptographic keys and policies
- Amazon Cognito — Application user identity and sign-in

### Azure

- Azure Virtual Machine — Cloud compute instance
- Azure Functions — Event driven serverless compute
- Blob Storage — Object and file storage
- Azure SQL — Managed relational database
- API Management — Managed API gateway
- Service Bus — Message queue and topic service
- Virtual Network — Private network boundary
- App Service — Managed web application host
- Azure Kubernetes Service — Managed Kubernetes clusters
- Azure Cosmos DB — Globally distributed NoSQL database
- Azure Key Vault — Managed keys, secrets, and certificates
- Azure Event Hubs — Managed event streaming service
- Azure Monitor — Metrics, logs, and alerts
- Application Gateway — Layer 7 traffic routing and protection
- Azure Storage Queue — Managed asynchronous message queue
- Azure Firewall — Managed network security boundary
- Azure Container Registry — Private container image registry
- Azure Front Door — Global application delivery and edge routing
- Azure Bastion — Managed private access to virtual machines
- Azure Data Factory — Data movement and pipeline orchestration
- Azure Synapse Analytics — Analytics workspace and data warehouse
- Azure Log Analytics — Workspace for querying operational logs
- Application Insights — Application telemetry and diagnostics
- Microsoft Entra ID — Workforce identity and access management
- Managed Identity — Workload identity without stored credentials
- Private Endpoint — Private network access to a managed service
- Azure Traffic Manager — DNS-based global traffic distribution
- Azure Static Web Apps — Static web hosting with integrated APIs
- Azure Container Apps — Managed serverless container applications
- Azure Database for PostgreSQL — Managed PostgreSQL relational database
- Azure CDN — Edge caching and content delivery
- Azure DNS — Managed public and private DNS zones
- Azure Web Application Firewall — Web application traffic inspection and protection
- Azure Data Explorer — Fast analytics for telemetry and time-series data
- Azure Machine Learning — Machine learning model training and deployment

### Google Cloud

- Compute Engine — Cloud compute instance
- Cloud Functions — Event driven serverless compute
- Cloud Storage — Object storage bucket
- Cloud SQL — Managed relational database
- API Gateway — Managed HTTP API entry point
- Pub/Sub — Publish and subscribe messaging
- VPC Network — Virtual private cloud boundary
- Cloud Load Balancing — Managed traffic distribution
- Google Kubernetes Engine — Managed Kubernetes clusters
- Cloud Run — Managed container application platform
- Cloud Firestore — Managed document database
- Cloud Spanner — Globally distributed relational database
- Cloud Monitoring — Metrics, logs, and alerting
- Secret Manager — Managed secret storage and access
- Cloud DNS — Managed DNS zones and records
- Cloud Firewall — VPC firewall rules and protection
- BigQuery — Serverless data warehouse and analytics
- Bigtable — Wide-column NoSQL database
- AlloyDB for PostgreSQL — Managed PostgreSQL-compatible database
- Memorystore — Managed in-memory cache service
- Cloud Build — Managed build and delivery pipelines
- Cloud Logging — Centralized log collection and analysis
- Dataflow — Managed batch and streaming data pipelines
- Cloud Scheduler — Managed cron-style job scheduling
- Cloud Tasks — Managed asynchronous task queues
- Apigee — API design, security, and lifecycle management
- Filestore — Managed network file storage
- Cloud Armor — Application and network DDoS protection
- Cloud Key Management Service — Managed cryptographic keys and rotation
- Cloud Router — Dynamic routing for cloud networks
- Cloud Composer — Managed workflow orchestration
- Vertex AI — Machine learning and generative AI platform
- Artifact Registry — Managed artifact and container image registry
- Cloud CDN — Edge caching and content delivery

## Provider-neutral cloud and integration components

### Cloud | Provider-neutral | Compute

- Compute instance — Provider-neutral virtual machine or compute instance
- Container runtime — Containerized application or task
- Kubernetes cluster — Managed Kubernetes cluster and node pool
- Machine learning service — Model training, serving, and inference

### Cloud | Provider-neutral | Networking

- API gateway — Managed API entry point and policy layer
- Load balancer — Traffic distribution across healthy backends
- Content delivery network — Edge cache and content delivery
- DNS service — Managed domain names, zones, and records
- Cloud firewall — Network rules and traffic inspection
- Private cloud network — Private virtual network and subnets

### Cloud | Provider-neutral | Integration

- Event bus — Event routing between producers and consumers
- Publish / subscribe topic — Topic with multiple subscribers
- Stream processor — Real-time event processing pipeline
- Workflow orchestrator — Multi-step workflow and state orchestration
- Scheduler — Scheduled job or recurring task
- Webhook — HTTP callback from an external event

### Cloud | Provider-neutral | Data

- In-memory cache — Low-latency key-value cache
- File storage — Managed shared file system
- Block storage — Persistent block volume for compute or databases
- Document database — Document-oriented NoSQL database
- Time-series database — Database for timestamped metrics and events
- Data lake — Scalable store for raw and curated datasets
- Data warehouse — Analytics store for structured datasets
- Search service — Indexed search across application data
- Data replication — Copy datasets across regions or stores
- Relational database — Managed SQL database with structured tables

### Cloud | Provider-neutral | Security

- Secret store — Protected storage for credentials and secrets
- Key management — Cryptographic key creation, policy, and rotation
- Identity service — Workforce or application identity provider
- Audit log — Security event and access history
- Certificate authority — Certificate issuance and trust chain

### Cloud | Provider-neutral | Platform

- Container registry — Registry for versioned container images
- Backup service — Backup, retention, and recovery policy
- Artifact store — Versioned build and package artifacts

### Cloud | Provider-neutral | Operations

- Metrics and monitoring — Metrics, alerts, and service health
- Log service — Central log collection and query

### Cloud | Kubernetes

- Pod — One or more containers sharing a network and storage
- Deployment — Desired replica count and rolling application updates
- Service — Stable endpoint for a set of pods
- Ingress — HTTP routing into a cluster
- Config map — Configuration supplied to workloads
- Persistent volume — Durable storage mounted by cluster workloads

### Architecture | Enterprise integration

- Message router — Route messages to different destinations
- Message filter — Pass only matching messages to downstream systems
- Message splitter — Split one message into multiple parts
- Message aggregator — Combine related messages into one result
- Message transformer — Convert a message into a target format
- Dead-letter queue — Hold messages that could not be processed
- Message channel — Transport messages between systems
- Retry policy — Retry failed work with a configured schedule

## Diagram formats

- Mermaid — Text syntax for flowcharts and related diagrams.
- PlantUML — Text syntax for supported UML diagrams.
- D2 — Text syntax for architecture diagrams.
- Cloud DSL — Text syntax for cloud architectures.
- Org chart DSL — Text syntax for organization charts.
- CSV — Tabular text for diagram or chart data.
- JSON — Structured data and graph import.
- SQL — Relational schema import and export.
- DBML — Text format for database models.
- Graphviz DOT — Text format for graph descriptions.
- Draw.io — Editable XML interchange for the supported diagram subset.
- Excalidraw JSON — Editable JSON interchange for supported scene elements.
- SVG — Scalable vector graphic format.
- PDF — Portable document import and export format.

## Import sources

### Images and diagrams

- Raster images — Imported and embedded on the canvas.
- PDF pages — Imported as pages for markup.
- SVG artwork — Supported vectors become editable paths; other artwork is embedded safely.
- Draw.io XML — Imports supported shapes, text, styles, connectors, and waypoints; export is also available.
- Excalidraw JSON — Imports supported scene elements; export is also available.
- CSV — Creates editable diagrams or charts from tabular data.
- JSON records and graph data — Creates editable nodes and relationships.
- Graphviz DOT — Imports supported graph descriptions.
- Mermaid — Imports supported flowchart and sequence syntax.
- D2 — Imports supported nodes, groups, styles, and connectors.
- PlantUML — Imports supported diagram subsets.

### APIs, infrastructure, and schemas

- OpenAPI — Creates editable API operation and schema maps.
- Kubernetes YAML or JSON — Creates resource nodes and recognized relationships.
- Terraform HCL or .tf.json — Imports resource, data, and module blocks.
- Terraform plan or state JSON — Maps resources and planned changes.
- Docker Compose YAML — Maps services, networks, volumes, and dependencies.
- Ansible YAML — Maps plays, tasks, handlers, and roles.
- AWS CloudFormation or CDK templates — Maps declared resources and dependencies.
- Azure ARM templates — Maps Azure resources and dependencies.
- Azure Bicep — Maps resource declarations and supported references.
- SQL CREATE TABLE — Creates editable relational schema cards.
- JSON table definitions or JSON Schema — Creates editable schema cards.

## Diagram guides and sample labels

- Order approval — Trace a request through a decision and two outcomes.
- Order domain classes — Show a small object model and its ownership relationships.
- Checkout sequence — Follow messages between a person, app, and payment service.
- Customer and orders — Connect related records and make the key fields visible.
- Request handling — Model a service task, a decision, and a human review path.
- Customer portal context — Place people, your system, and external systems in one view.
- Public service edge — Show traffic passing through protection and distribution layers.
- Cloud application — Group an API, worker, queue, and database around one request path.
- Session state — Track a session from creation to active, paused, or closed.
- Idea map — Expand one topic into themes, questions, and next steps.
- Project idea — Central topic node used in the idea map example.
- User journey map — Map a person's steps, friction, and improvement opportunities.
- Order service use cases — Show who uses a system and which outcomes it provides.
- Component architecture — Group application components and show their dependencies.
- Service deployment — Map software artifacts onto their runtime environments.
- API authentication — Trace token acquisition, validation, and a protected request.
- Customer data flow — Follow information from an external source through processing and storage.
- Git feature workflow — Sketch a short-lived branch, review, checks, and merge path.
- CI/CD pipeline — Model checks, parallel build work, release approval, and deployment.
- Threat model — Map a protected system, a data store, a trust boundary, and review prompts.
- C4 container view — Zoom into one software system to show its applications and data stores.
- C4 dynamic view — Explain how system parts collaborate to complete one important scenario.
- Kubernetes cluster — Separate control-plane responsibilities from worker workloads.
- Data pipeline — Trace records from collection through processing into reporting.
- Incident response — Show a clear path from alert triage through recovery and review.
- Decision tree — Turn a multi-step choice into visible conditions and outcomes.
