import { For } from "solid-js";
import { DIAGRAM_TEMPLATES } from "../features/diagrams/templates";

type Props = { onClose: () => void };

export function TemplateGallery(props: Props) {
  return <div class="confirm-backdrop template-gallery-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section class="confirm-dialog template-gallery" role="dialog" aria-modal="true" aria-labelledby="template-gallery-title">
      <header><div><span class="eyebrow">REFERENCE ONLY</span><h2 id="template-gallery-title">Diagram guides</h2></div><button class="help-close" aria-label="Close diagram guides" onClick={props.onClose}>&times;</button></header>
      <p>Use these examples as guides while drawing on a blank canvas. They cannot be edited or added to your sketch.</p>
      <div class="template-gallery-grid">
        <For each={DIAGRAM_TEMPLATES}>{template => <article class="template-gallery-card">
          <span class={`template-gallery-preview template-preview-${template.id}`} aria-hidden="true"><i /><i /><i /><b /></span>
          <span class="template-gallery-copy"><small>{template.category}</small><strong>{template.name}</strong><span>{template.description}</span></span>
        </article>}</For>
      </div>
      <footer><span>New sketches always start blank.</span><button class="quiet-button" onClick={props.onClose}>Close</button></footer>
    </section>
  </div>;
}
