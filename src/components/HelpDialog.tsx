import { Show } from "solid-js";
import { HelpFeatureCatalog } from "./HelpFeatureCatalog";

export type HelpSection = "guide" | "shortcuts";

type Props = {
  open: boolean;
  section: HelpSection;
  shortcuts: [string, string][];
  onClose: () => void;
};

export function HelpDialog(props: Props) {
  return <Show when={props.open}>
    <div class="confirm-backdrop help-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) props.onClose(); }}>
      <section class="confirm-dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <header><div><span class="eyebrow">{props.section === "guide" ? "SKETCHDRAW GUIDE" : "SHORTCUT REFERENCE"}</span><h2 id="help-title">{props.section === "guide" ? "Guide" : "Keyboard shortcuts"}</h2></div><button type="button" class="help-close" aria-label="Close help" onClick={props.onClose}>&times;</button></header>
        <div class="help-content">
          <Show when={props.section === "guide"} fallback={<section class="help-shortcuts-section"><h3>Keyboard shortcuts</h3><p>Use these shortcuts while the canvas is active. Text fields keep their standard editing shortcuts.</p><table class="shortcut-table"><thead><tr><th scope="col">Shortcut</th><th scope="col">Action</th></tr></thead><tbody>{props.shortcuts.map(([key, action]) => <tr><th scope="row"><kbd>{key}</kbd></th><td>{action}</td></tr>)}</tbody></table></section>}>
            <div class="help-guide">
              <section><h3>Start a sketch</h3><p>Create a new file or open a <code>.sketch</code> document. When an older format is opened, SketchDraw explains what will be removed and asks before replacing the file. Declining closes it without saving. SketchDraw saves edits to the active file automatically; the save status shows whether changes are still being written.</p></section>
              <section><h3>Draw and style</h3><p>Choose a tool from the toolbar, then click or drag on the canvas. Common style controls sit beside the canvas; open Properties for the full settings panel. Line options include one-, two-, and three-control-point curves plus a four-point editable line; lines and arrows both support arrowheads. Hold Space or choose Hand to pan, or use the mouse wheel to zoom around the pointer.</p></section>
              <section><h3>Select and edit</h3><p>Use Select to click an object or drag a marquee around objects. Drag selected items to move them. Use handles to resize or rotate, and double-click a shape to edit its label. Select Text and click once to place text. The bucket fills a closed shape without selecting it. Right-click the canvas for object commands.</p></section>
              <section><h3>Files, pages, and export</h3><p>Use File to create, open, save, import images, export PNG/SVG/PDF, or clear the canvas. Add and manage pages from the page strip. Use View to change the theme and whiteboard color. Autosave saves local edits. On Windows, file watching and a 30-second polling fallback detect outside changes and surface conflicts.</p></section>
              <section class="touch-guide-section"><h3>Phone and tablet controls</h3><p>Use the touch toolbar to choose tools; tool choices and Canvas options open their own panels. The Canvas options panel includes grid, snapping, fit-to-view, and paper appearance controls.</p></section>
              <section class="touch-guide-section"><h3>Properties and components</h3><p>Use the Quick style controls beside the toolbar for common color and width changes. Open Advanced style for tool-specific options. Tap Modeling components to search and insert diagram components, and use Layers to organize objects.</p></section>
              <section class="touch-guide-section"><h3>Touch, stylus, and navigation</h3><p>Draw with a finger or stylus. Pinch with two fingers to zoom. Open Pages in the top bar to switch, add, rename, or organize pages. The zoom percentage button recenters the canvas and resets to 100%. Set tap-only actions under Gestures &gt; Tap actions. Configure one-finger drags and two- or three-finger movement separately under Gestures &gt; Finger movements. A compatible stylus uses the active tool. Tap a style control to change the active tool's color or width.</p></section>
              <HelpFeatureCatalog />
            </div>
          </Show>
        </div>
        <footer><span>&copy; 2026 Toushal Sampat. See the README and version 10 file format guide for details.</span><button type="button" class="save-button" onClick={props.onClose}>Close</button></footer>
      </section>
    </div>
  </Show>;
}
