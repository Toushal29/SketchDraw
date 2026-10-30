import { createSignal, For, Show } from "solid-js";
import type { NoteKind } from "../../model";
import "./text-tool-panel.css";

export type TextToolMode = "text" | "markdown" | "table" | NoteKind;

type Props = {
  activeMode: TextToolMode;
  onSelect: (mode: TextToolMode) => void;
};

const OPTIONS: { mode: TextToolMode; label: string; path: string }[] = [
  { mode: "text", label: "Text", path: "M4 6h16M12 6v13m-4 0h8" },
  { mode: "markdown", label: "Markdown", path: "M3 6h18M5 11h4l3 4 3-4h4M5 19h14" },
  { mode: "table", label: "Table", path: "M3 4h18v16H3zM3 10h18M3 15h18M10 4v16M16 4v16" },
  { mode: "note", label: "Note + code", path: "M5 4h14v13l-4 3H5zM8 9h8M8 13h6" },
  { mode: "sticky", label: "Sticky note", path: "M5 4h14v12l-5 5H5zM14 16v5m-6-12h8" },
  { mode: "checklist", label: "Checklist", path: "m4 6 2 2 3-4M12 6h8M4 14l2 2 3-4m3 2h8" },
];

export function TextToolPanel(props: Props) {
  const [collapsed, setCollapsed] = createSignal(false);

  return <div class="tool-options text-options text-tool-panel" classList={{ "text-tool-panel-collapsed": collapsed() }} role="menu" aria-label="Text tools">
    <div class="text-tool-panel-heading">
      <span>Text tools</span>
      <button type="button" role="menuitem" aria-label={collapsed() ? "Expand text tools" : "Collapse text tools"} title={collapsed() ? "Expand" : "Collapse"} aria-expanded={!collapsed()} onClick={() => setCollapsed(value => !value)}>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d={collapsed() ? "m2.5 4.5 3.5 3 3.5-3" : "m2.5 7.5 3.5-3 3.5 3"} /></svg>
      </button>
    </div>
    <Show when={!collapsed()}>
      <div class="text-tool-panel-options">
        <For each={OPTIONS}>{option => <button type="button" role="menuitemradio" class="text-tool-option" classList={{ active: props.activeMode === option.mode }} aria-checked={props.activeMode === option.mode} title={option.label} onClick={() => props.onSelect(option.mode)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={option.path} /></svg><span>{option.label}</span>
        </button>}</For>
      </div>
    </Show>
  </div>;
}
