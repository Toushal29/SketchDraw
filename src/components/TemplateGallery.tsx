import { For } from "solid-js";
import { DIAGRAM_TEMPLATES } from "../features/diagrams/templates";

type Props = { onClose: () => void; onInsert: (id: typeof DIAGRAM_TEMPLATES[number]["id"]) => void };

export function TemplateGallery(props: Props) {
  return <div class="confirm-backdrop template-gallery-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="confirm-dialog template-gallery" role="dialog" aria-modal="true" aria-labelledby="template-gallery-title">
      <header><div><span class="eyebrow">EDITABLE STARTERS</span><h2 id="template-gallery-title">Starter diagrams</h2></div><button class="help-close" aria-label="Close starter diagrams" onClick={props.onClose}>&times;</button></header>
      <p>Insert a starter diagram to add editable shapes, components, and connectors to the current page.</p>
      <div class="template-gallery-grid">
        <For each={DIAGRAM_TEMPLATES}>{template => <article class="template-gallery-card">
          <span class={`template-gallery-preview template-preview-${template.id}`} aria-hidden="true"><i /><i /><i /><b /></span>
          <span class="template-gallery-copy"><small>{template.category}</small><strong>{template.name}</strong><span>{template.description}</span><button type="button" class="quiet-button" onClick={() => props.onInsert(template.id)}>Insert diagram</button></span>
        </article>}</For>
      </div>
      <footer><span>New sketches always start blank.</span><button class="quiet-button" onClick={props.onClose}>Close</button></footer>
    </section>
  </div>;
}
