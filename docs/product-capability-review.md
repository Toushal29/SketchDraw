# SketchDraw planning and design capability review

## Scope

This review compares the current SketchDraw workflows with the use cases shown in the supplied examples and the planning and diagram patterns emphasized by Lucidchart, Eraser, UML, and architecture guidance. It is a product-scope review, not a claim of feature parity with hosted products.

## What SketchDraw already supports

| Area | Current capability |
| --- | --- |
| Canvas and visual design | Multi-page `.sketch` documents, freehand drawing, shapes, text and Markdown cards, frames, reusable component masters, layers, page links, presentation mode, and PNG/SVG/PDF output. |
| Software and architecture models | Native UML class, sequence, state, use-case, component, deployment, and activity elements; ERD; BPMN; C4; software and cloud elements; network topology; GUI design components; editable connectors, ports, routing, validation, and automatic layout. |
| Code and data workflows | Editable imports for Mermaid, PlantUML subset, DOT, D2, OpenAPI, SQL, JSON Schema, draw.io, Excalidraw, Terraform, Kubernetes, Docker Compose, Ansible, CloudFormation/CDK, Azure ARM/Bicep, and other listed formats. Some source-specific detail is intentionally simplified. |
| Planning | Separate local `.sdplan` files with notes, tasks, priorities, dates, estimates, checklists, dependencies, milestones, configurable Kanban stages, timeline, calendar, decisions, risks, attachments, reports, CSV and calendar exchange. |
| Help to get started | Nine editable diagram guides currently cover order approval, UML class and sequence, ER, BPMN, C4 context, network edge, cloud service, and state machine patterns. |
| Portability and offline use | Documents are local files. Existing `.sketch` v9/v10 files can be converted to current v2 after confirmation; planning is stored separately. SketchDraw does not host files or live collaboration. |

## Reference review

- [Lucidchart](https://lucid.co/lucidchart) presents a broad diagramming workspace around templates, process and technical diagrams, integrations, collaboration, and AI-assisted creation. Its [official AI overview](https://help.lucid.co/hc/en-us/articles/31463501699476-AI-in-Lucid-overview) describes AI support as part of that hosted workflow.
- [Eraser](https://www.eraser.io/) focuses on technical diagrams and documentation. Its [official product guide](https://docs.eraser.io/what-is-eraser) describes editable diagrams from prompts, images, files, code, and infrastructure sources, plus Markdown documentation and repository workflows.
- The [OMG UML 2.5.1 specification](https://www.omg.org/spec/UML/2.5.1/PDF) defines the notation SketchDraw's UML elements draw from. In particular, component and deployment models need to communicate component responsibilities, interfaces, dependencies, deployed artifacts, and execution nodes rather than merely decorate boxes.
- The [C4 model](https://c4model.com/diagrams/notation) encourages views at different levels of detail. The [architecture diagram guide from vFunction](https://vfunction.com/blog/architecture-diagram-guide/) likewise emphasizes choosing a view that answers a question, such as context, components, runtime deployment, or data flow, instead of putting every concern on one canvas.
- The [Pro Git branching workflows guide](https://git-scm.com/book/en/v2/Git-Branching-Branching-Workflows) describes topic-branch and long-running-branch patterns; the new Git example is a customizable discussion starter.
- [GitHub Actions workflow concepts](https://docs.github.com/en/actions/get-started/understanding-github-actions) describe triggers, jobs, runner environments, and steps, which inform the editable CI/CD example.
- The [OWASP threat modeling cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html) recommends examining technical designs through data flows, trust boundaries, and relevant threat categories; the new example is a prompt for review, not a security assessment.

## Gaps and priorities

### Coverage gap: common use cases are harder to discover than the underlying tools

The screenshots list brainstorming, documentation, user journeys, use cases, components, deployment, APIs, Git, CI/CD, and threat modeling. SketchDraw already has enough general shapes or modeling elements to draw many of these, but the guide gallery demonstrates only nine patterns. As a result, users have to know which palette items to assemble before they can start.

| Use-case family in the examples | Existing foundation | Gap addressed here |
| --- | --- | --- |
| Design docs, documentation, interviews | Markdown project notes, canvas note cards, and project reports | Project-note templates give common documents a useful starting structure. |
| Brainstorming and mind maps | Freeform canvas shapes, text, connectors, and grouping | A mind-map guide demonstrates a central topic with non-directional branches. |
| Flowchart, sequence, ERD, state, BPMN, database, network, C4, and cloud | Native notation elements, importers, and nine existing guides | The existing guides remain; new guides add more specific workflows and architectural views. |
| User journeys, UML use cases, component and deployment views | User-interface components and native UML/C4 library elements | The gallery now has examples for each so users can start from a modeled pattern. |
| API, Git, DevOps, and CI/CD | OpenAPI and infrastructure imports, connectors, and general flow/sequence elements | New authentication, Git branching, and CI/CD examples make common software workflows discoverable. |
| Threat modeling | Data-flow and security-related network elements | A threat-model guide prompts review of trust boundaries and STRIDE categories; it does not perform a security analysis. |

These additions are starting points, not complete automation. Terraform, Kubernetes, and API files can be imported and visualized, but SketchDraw does not execute a deployment, sync a Git repository, test an API, or calculate a threat assessment.

**Action:** expand the guide gallery with editable mind-map, user-journey, UML use-case, UML component, deployment, API authentication sequence, data-flow, Git workflow, CI/CD pipeline, and threat-model examples. Keep their cards and inserted diagrams generated from one guide definition and use existing native elements so they save, render, export, and edit through the established document paths.

### Planning and design are present, with a deliberate file boundary

Planning is already a substantial capability in `.sdplan`; Canvas and Design remain in `.sketch`. The split gives each workflow its own document lifecycle and avoids silently moving planning records during legacy sketch conversion. Recombining them would increase migration and data-loss risk without a demonstrated user need.

The notes editor accepted freeform content but offered no reusable design or documentation structure. This made common handoffs such as a design brief, requirements checklist, interview notes, meeting record, or architecture decision slower to start.

**Action:** keep the file boundary, improve diagram discovery through richer examples, and add note templates using the existing `.sdplan` note fields. The planning views already cover core project tracking; templates fill the documentation-start gap without changing the file schema.

### Hosted AI and repository ingestion are not part of the current product

Lucid and Eraser expose hosted AI, repository-based generation, and team workflows. SketchDraw is explicitly local-first and has no document service or live collaboration. Adding an online model or repository connector would change privacy, networking, and product scope, so this review does not add those services. Existing code and infrastructure importers remain the local, explicit-input path.

**Action:** retain local-first behavior. The implementation below adds reusable native starting points, not network-dependent generation.

### Validation and model depth

SketchDraw has general, BPMN, and ERD validation, and components provide type-specific editable details. The new guides will make patterns easier to learn; they do not claim full UML conformance or replace domain review. Specialized model validators or additional interchange formats should be driven by a concrete workflow and fixture set.

## Implementation plan

1. Add the missing high-frequency diagram patterns as native editable guides.
2. Add a non-directional relationship option for mind-map and UML association connectors, preserving directed arrows elsewhere.
3. Document the guide coverage in README and keep the product capability review alongside it.
4. Run typecheck and production build to check integration with existing document and rendering paths.

## Implemented

The gallery now has 19 editable examples, with added patterns for brainstorming, user journeys, UML use cases and components, deployment, API authentication, data flow, Git workflows, CI/CD, and threat modeling. Guides use existing library components and canvas shapes; relationship lines can be non-directional where the notation calls for associations instead of message flow. Planning Notes now offer Design brief, Requirements, User interview, Meeting notes, and Architecture decision templates using the existing note data model. README describes both additions.
