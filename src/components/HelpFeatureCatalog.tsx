export function HelpFeatureCatalog() {
  return <>
    <section class="help-guide-feature-map">
      <h3>Feature map</h3>
      <div class="help-feature-grid">
        <article><strong>[1] Canvas and drawing</strong><p>Draw freehand or place shapes and text. Connect objects with manual routes; Windows also supports automatic connector routing.</p></article>
        <article><strong>[2] Styling</strong><p>Set line, fill, and text styles; choose themes and paper patterns; use grid and object snapping with the minimap.</p></article>
        <article><strong>[3] Structure and interaction</strong><p>Split a sketch into pages, link objects between pages, group objects, and search with Ctrl+F. Use arrow keys to move through search results. Validate checks connector and schema references; dialogs and search controls have keyboard and screen-reader labels.</p></article>
        <article><strong>[4] Shapes and reusable components</strong><p>Browse flowchart symbols and UML, ER, C4, cloud, network, and BPMN components. Save selections as stencils or create linked document masters with variants, named ports, and per-instance overrides.</p></article>
        <article><strong>[5] Diagram layout and validation</strong><p>Choose layered, tree, radial, force, or stress layout for a page or selection. Validate general, BPMN, and ER diagrams, then select and zoom to reported issues.</p></article>
        <article><strong>[6] Import and export editable diagrams</strong><p>Move supported shapes, text, connector bindings, line styles, labels, and images between SketchDraw, draw.io, and Excalidraw. Draw.io imports report kept, simplified, and skipped objects. Insert editable UML, ER, BPMN, C4, and network starters; generate cards from CSV or JSON; and reopen Mermaid or PlantUML source for editing. Unsupported format-specific details may be simplified.</p></article>
        <article><strong>[7] Architecture diagram aids</strong><p>Add legends and callouts, number selected connectors in sequence order, and run automatic layout where available.</p></article>
        <article><strong>[8] Preview linked content</strong><p>Add a web address as a canvas card. Double-click it to load supported web or document previews; pages that block embedding can still be opened in a browser.</p></article>
        <article><strong>[9] Windows command palette</strong><p>On Windows, press Ctrl+K to search tools, components, templates, layout, layer, validation, source, and export actions. Recent commands appear first when the search is empty; assigned shortcuts are shown beside palette actions and listed in Keyboard shortcuts.</p></article>
      </div>
    </section>
    <section class="help-guide-use-cases">
      <h3>[10] What people use SketchDraw for</h3>
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
