import { For, Show } from "solid-js";
import type { LiveDiagramFormat } from "../../model";
import { indentTextarea } from "../../components/textarea-indent";
import { LIVE_DIAGRAM_FORMATS } from "./live-diagram";
import "./live-diagram-panel.css";

export type LiveDiagramPanelProps = {
  format: LiveDiagramFormat;
  source: string;
  canEdit: boolean;
  status: { kind: "idle" | "ok" | "error"; message: string };
  linkedLine?: number;
  onFormat: (format: LiveDiagramFormat) => void;
  onSource: (source: string) => void;
  /** Reports the caret's line so the matching shapes can be selected. */
  onCaretLine: (lineIndex: number, text: string) => void;
  onTextarea: (element: HTMLTextAreaElement) => void;
  onExample: () => void;
  onClose: () => void;
};

/** Code on the left, the diagram on the canvas to its right. Typing rebuilds the diagram; the caret and the selection stay linked. */
export function LiveDiagramPanel(props: LiveDiagramPanelProps) {
  const reportCaret = (area: HTMLTextAreaElement) => {
    const before = area.value.slice(0, area.selectionStart);
    const lineIndex = before.split("\n").length - 1;
    props.onCaretLine(lineIndex, area.value.split("\n")[lineIndex] ?? "");
  };
  return <aside class="live-diagram-panel" role="dialog" aria-label="Live diagram editor" onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); props.onClose(); } }}>
    <header>
      <strong>Live diagram editor</strong>
      <button type="button" class="help-close" aria-label="Close live diagram editor" onClick={props.onClose}>&times;</button>
    </header>
    <div class="live-diagram-controls">
      <label>Language<select aria-label="Diagram language" value={props.format} disabled={!props.canEdit} onChange={event => props.onFormat(event.currentTarget.value as LiveDiagramFormat)}><For each={LIVE_DIAGRAM_FORMATS}>{format => <option value={format.id}>{format.label}</option>}</For></select></label>
      <button type="button" disabled={!props.canEdit} onClick={props.onExample}>Insert example</button>
    </div>
    <textarea ref={props.onTextarea} class="live-diagram-source" aria-label="Diagram code" spellcheck={false} wrap="off" value={props.source} disabled={!props.canEdit}
      onInput={event => { props.onSource(event.currentTarget.value); reportCaret(event.currentTarget); }}
      onKeyUp={event => { if (!event.ctrlKey && !event.metaKey && event.key !== "Tab") reportCaret(event.currentTarget); }}
      onClick={event => reportCaret(event.currentTarget)}
      onKeyDown={event => { if (event.key === "Tab" && !event.shiftKey) indentTextarea(event, value => props.onSource(value)); }} />
    <p class="live-diagram-status" classList={{ error: props.status.kind === "error", ok: props.status.kind === "ok" }} role={props.status.kind === "error" ? "alert" : "status"}>
      {props.status.message || "Type code and the diagram on the canvas updates."}
    </p>
    <Show when={props.linkedLine !== undefined}><p class="live-diagram-link">Linked to line {props.linkedLine! + 1}</p></Show>
    <p class="live-diagram-hint">Click a line to select its shapes; select a shape to jump to its line. Editing the code replaces generated shapes, so changes made by hand on them are not kept.</p>
  </aside>;
}
