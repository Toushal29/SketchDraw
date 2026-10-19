export function HelpFeatureCatalog() {
  return <>
    <section class="help-guide-feature-map">
      <h3>Feature map</h3>
      <div class="help-feature-grid">
        <article><strong>[1] Canvas and drawing</strong><p>Draw freehand or place shapes and text. Connect objects with manual routes; Windows also supports automatic connector routing.</p></article>
        <article><strong>[2] Styling</strong><p>Set line, fill, and text styles; choose themes and paper patterns; use snapping, grids, alignment guides, and the minimap.</p></article>
        <article><strong>[3] Structure and interaction</strong><p>Split a sketch into pages, link objects between pages, group objects, and search with Ctrl+F. Use arrow keys to move through search results. Validate checks connector and schema references; dialogs and search controls have keyboard and screen-reader labels.</p></article>
        <article><strong>[4] Shapes and reusable components</strong><p>Browse flowchart symbols and UML, ER, C4, cloud, network, and BPMN components. Save a selection to My stencils to reuse it on any page.</p></article>
        <article><strong>[5] Import and export editable diagrams</strong><p>Move supported shapes, text, connector bindings, line styles, labels, and images between SketchDraw, draw.io, and Excalidraw. Generate cards from CSV or JSON, import Kubernetes YAML and common Terraform resource, data, and module blocks, and reopen Mermaid or PlantUML source for editing. Unsupported format-specific details may be simplified.</p></article>
        <article><strong>[6] Architecture diagram aids</strong><p>Add legends and callouts, number selected connectors in sequence order, and run automatic layout where available.</p></article>
        <article><strong>[7] Preview linked content</strong><p>Add a web address as a canvas card. Double-click it to load supported web or document previews; pages that block embedding can still be opened in a browser.</p></article>
      </div>
    </section>
    <section class="help-guide-use-cases">
      <h3>[8] What people use SketchDraw for</h3>
      <p>These are starting points. Some have dedicated symbols or components; the rest can be built with shapes, text, and connectors.</p>
      <ul class="help-use-case-grid">
        <li><strong>Workflows</strong><span>Process maps, flowcharts, and decision trees</span></li>
        <li><strong>Software and systems</strong><span>UML, database schemas, C4, network, and cloud architecture diagrams</span></li>
        <li><strong>Project planning</strong><span>Task estimates and repeats, workflow boards, searchable plan files, timelines, milestones, reports, and calendar exchange</span></li>
        <li><strong>Brainstorming</strong><span>Mind maps, concept maps, storyboards, sticky notes, and checklists</span></li>
        <li><strong>Product design</strong><span>App or website wireframes and screen flows</span></li>
        <li><strong>Technical layouts</strong><span>Floor plans, rack layouts, circuits, and hardware diagrams</span></li>
        <li><strong>Communication</strong><span>Roadmaps, timelines, infographics, and visual explanations</span></li>
      </ul>
    </section>
  </>;
}
