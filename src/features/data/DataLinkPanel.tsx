import { For, Show, createEffect, createSignal } from "solid-js";
import type { DataLink, DataSource } from "../../model";
import { MAX_DATA_SOURCES, distinctValues, parseDataRules } from "./data-binding";
import "../diagrams/live-diagram-panel.css";
import "./data-link-panel.css";

export type DataLinkPanelProps = {
  sources: DataSource[];
  canEdit: boolean;
  /** The single selected object that can be linked, if any. */
  selection?: { label: string; link?: DataLink; canShowText: boolean };
  message?: string;
  onAddFile: () => void;
  onRefresh: (id: string) => void;
  onRemove: (id: string) => void;
  onLink: (link: DataLink) => void;
  onUnlink: () => void;
  onClose: () => void;
};

const EXAMPLE_RULES = "status = down -> fill #d64545, text #ffffff\nload >= 80 -> stroke #b9771d";

/** Link shapes to rows of a CSV or JSON file: show a column as the label and color shapes by rules. */
export function DataLinkPanel(props: DataLinkPanelProps) {
  const [sourceId, setSourceId] = createSignal(""); const [key, setKey] = createSignal(""); const [value, setValue] = createSignal(""); const [label, setLabel] = createSignal(""); const [rules, setRules] = createSignal("");
  createEffect(() => {
    const link = props.selection?.link;
    setSourceId(link?.source ?? props.sources[0]?.id ?? ""); setKey(link?.key ?? ""); setValue(link?.value ?? ""); setLabel(link?.label ?? ""); setRules(link?.rules ?? "");
  });
  const source = () => props.sources.find(item => item.id === sourceId());
  const parsed = () => parseDataRules(rules());
  const canApply = () => !!source() && !!key() && !!value().trim();
  return <aside class="live-diagram-panel data-link-panel" role="dialog" aria-label="Linked data" onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); props.onClose(); } }}>
    <header><strong>Linked data</strong><button type="button" class="help-close" aria-label="Close linked data" onClick={props.onClose}>&times;</button></header>
    <section aria-label="Data files">
      <div class="live-diagram-controls"><button type="button" disabled={!props.canEdit || props.sources.length >= MAX_DATA_SOURCES} onClick={props.onAddFile}>Add CSV or JSON file...</button></div>
      <ul class="data-source-list"><For each={props.sources}>{item => <li>
        <span><strong>{item.name}</strong><small>{item.rows.length} rows, {item.headers.length} columns{item.updatedAt ? `, loaded ${new Date(item.updatedAt).toLocaleDateString()}` : ""}</small></span>
        <button type="button" disabled={!props.canEdit} aria-label={`Refresh ${item.name} from its file`} onClick={() => props.onRefresh(item.id)}>Refresh</button>
        <button type="button" disabled={!props.canEdit} aria-label={`Remove ${item.name}`} onClick={() => props.onRemove(item.id)}>&times;</button>
      </li>}</For></ul>
      <Show when={!props.sources.length}><p class="live-diagram-hint">Add a file, then select a shape to link it to one row. The data is saved inside the sketch, so diagrams still open without the file.</p></Show>
    </section>
    <Show when={props.selection && props.sources.length}>
      <section aria-label="Link the selected object" class="data-link-form">
        <h3>Selected: {props.selection!.label}</h3>
        <label>Data file<select aria-label="Data file" value={sourceId()} disabled={!props.canEdit} onChange={event => { setSourceId(event.currentTarget.value); setKey(""); setValue(""); setLabel(""); }}><For each={props.sources}>{item => <option value={item.id}>{item.name}</option>}</For></select></label>
        <label>Match column<select aria-label="Match column" value={key()} disabled={!props.canEdit} onChange={event => { setKey(event.currentTarget.value); setValue(""); }}><option value="">Choose a column</option><For each={source()?.headers ?? []}>{header => <option value={header}>{header}</option>}</For></select></label>
        <label>Row value<input aria-label="Row value" list="data-link-values" value={value()} placeholder="Value that identifies the row" disabled={!props.canEdit || !key()} onInput={event => setValue(event.currentTarget.value)} /></label>
        <datalist id="data-link-values"><For each={source() && key() ? distinctValues(source()!, key()) : []}>{option => <option value={option} />}</For></datalist>
        <Show when={props.selection!.canShowText}><label>Show column as text<select aria-label="Text column" value={label()} disabled={!props.canEdit} onChange={event => setLabel(event.currentTarget.value)}><option value="">Keep current text</option><For each={source()?.headers ?? []}>{header => <option value={header}>{header}</option>}</For></select></label></Show>
        <label>Color rules<textarea aria-label="Color rules" rows="3" spellcheck={false} placeholder={EXAMPLE_RULES} value={rules()} disabled={!props.canEdit} onInput={event => setRules(event.currentTarget.value)} /></label>
        <Show when={parsed().errors.length}><p class="live-diagram-status error" role="alert">{parsed().errors.join(" ")}</p></Show>
        <div class="live-diagram-controls">
          <button type="button" disabled={!props.canEdit || !canApply() || parsed().errors.length > 0} onClick={() => props.onLink({ source: sourceId(), key: key(), value: value().trim(), ...(label() ? { label: label() } : {}), ...(rules().trim() ? { rules: rules() } : {}) })}>{props.selection!.link ? "Update link" : "Link object"}</button>
          <Show when={props.selection!.link}><button type="button" disabled={!props.canEdit} onClick={props.onUnlink}>Unlink</button></Show>
        </div>
        <p class="live-diagram-hint">Rules: <code>column operator value -&gt; fill|stroke|text #rrggbb</code>, one per line. Operators: = != &gt; &gt;= &lt; &lt;= contains. The first matching rule for each property wins.</p>
      </section>
    </Show>
    <Show when={props.message}><p class="live-diagram-status" role="status">{props.message}</p></Show>
  </aside>;
}
