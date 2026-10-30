import { Index, createSignal } from "solid-js";
import { markdownTableRows, serializeMarkdownTableRows } from "../app/markdown-table";

export function MarkdownTableEditor(props: { value: string; disabled?: boolean; onChange: (value: string) => void }) {
  const [mode, setMode] = createSignal<"table" | "markdown">("table");
  const rows = () => markdownTableRows(props.value);
  const update = (change: (rows: string[][]) => string[][]) => props.onChange(serializeMarkdownTableRows(change(rows().map(row => [...row])), props.value));
  return <div class="note-table-editor">
    <div class="note-table-mode" role="group" aria-label="Table editing mode">
      <button type="button" class={mode() === "table" ? "active" : ""} aria-pressed={mode() === "table"} onClick={() => setMode("table")}>Table</button>
      <button type="button" class={mode() === "markdown" ? "active" : ""} aria-pressed={mode() === "markdown"} onClick={() => setMode("markdown")}>Markdown</button>
    </div>
    {mode() === "markdown" ? <textarea class="note-table-markdown" aria-label="Markdown table source" value={props.value} maxlength="50000" disabled={props.disabled} onBlur={event => { if (event.currentTarget.value !== props.value) props.onChange(event.currentTarget.value); }} onKeyDown={event => event.stopPropagation()} /> : <>
      <div class="note-table-grid-scroll"><table class="note-table-grid"><tbody><Index each={rows()}>{(row, rowIndex) => <tr><Index each={row()}>{(cell, columnIndex) => <td><input aria-label={`${rowIndex === 0 ? "Header" : `Row ${rowIndex}`} column ${columnIndex + 1}`} value={cell()} disabled={props.disabled} onChange={event => update(next => { next[rowIndex][columnIndex] = event.currentTarget.value; return next; })} onKeyDown={event => event.stopPropagation()} /></td>}</Index></tr>}</Index></tbody></table></div>
      <div class="note-table-actions"><button type="button" disabled={props.disabled} onClick={() => update(next => [...next, Array(next[0].length).fill("")])}>+ Row</button><button type="button" disabled={props.disabled} onClick={() => update(next => next.map(row => [...row, ""]))}>+ Column</button><button type="button" disabled={props.disabled || rows().length <= 1} onClick={() => update(next => next.slice(0, -1))}>− Row</button><button type="button" disabled={props.disabled || rows()[0].length <= 2} onClick={() => update(next => next.map(row => row.slice(0, -1)))}>− Column</button></div>
    </>}
  </div>;
}
