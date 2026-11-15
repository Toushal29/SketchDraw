import { Show } from "solid-js";
import { HelpFeatureCatalog } from "./HelpFeatureCatalog";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HelpDialog(props: Props) {
  return <Show when={props.open}>
    <div class="confirm-backdrop help-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
      <section class="confirm-dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header><div><span class="eyebrow">SKETCHDRAW GUIDE</span><h2 id="help-title">Guide</h2></div><button type="button" class="help-close" aria-label="Close help" onClick={props.onClose}>&times;</button></header>
        <div class="help-content">
          <div class="help-guide">
              <section><h3>Start a sketch</h3><p>Create a new file or open a <code>.sketch</code> document. When an older format is opened, SketchDraw explains what will be removed and asks before replacing the file. Declining closes it without saving. SketchDraw saves edits to the active file automatically; the save status shows whether changes are still being written.</p></section>
              <section><h3>Draw and style</h3><p>Choose a tool from the toolbar, then click or drag on the canvas. Common style controls sit beside the canvas; open Properties for the full settings panel. Lines and arrows support straight, elbow, and curve routes. A Curve is visibly bent as soon as it is drawn. Use the route menu to add or remove evenly spaced points, then drag a point to shape the curve. Hold Space or choose Hand to pan, or use the mouse wheel to zoom around the pointer.</p></section>
              <section><h3>Select and edit</h3><p>Use Select to click an object or drag a marquee around objects. Drag selected items to move them. Use handles to resize or rotate, and double-click a shape to edit its label. Select Text and click once to place text. The bucket fills a closed shape without selecting it. Right-click the canvas for object commands.</p></section>
              <section><h3>Files, pages, and export</h3><p>Use File to create, open, save, rename, or close sketches. Use Import / Export for images, PDFs, editable diagrams, and output formats such as PNG, SVG, and PDF. Add and manage pages from the page strip. Use View to change the theme and whiteboard color. Autosave saves local edits. On Windows, file watching and a 30-second polling fallback detect outside changes and surface conflicts.</p></section>
              <section><h3>Properties and components</h3><p>Use the Quick style controls beside the toolbar for common color and width changes. Open Properties for tool-specific options. Use Modeling components to search and insert diagram components, and Layers to organize objects.</p></section>
              <section><h3>Pen and touch input</h3><p>A compatible Windows pen uses the active tool, including pressure and tilt where supported. On a touchscreen, use two fingers to pan or pinch to zoom.</p></section>
              <HelpFeatureCatalog />
          </div>
        </div>
        <footer><span>&copy; 2026 Toushal Sampat. See the README for version 3 sketch format details.</span><button type="button" class="save-button" onClick={props.onClose}>Close</button></footer>
      </section>
    </div>
  </Show>;
}
