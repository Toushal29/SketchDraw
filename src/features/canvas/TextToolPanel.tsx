import { For } from "solid-js";
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
  return <div class="tool-options text-tool-panel" role="menu" aria-label="Text tools">
    <For each={OPTIONS}>{option => <button type="button" role="menuitemradio" classList={{ active: props.activeMode === option.mode }} aria-checked={props.activeMode === option.mode} title={option.label} onClick={() => props.onSelect(option.mode)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d={option.path} /></svg><span>{option.label}</span>
    </button>}</For>
  </div>;
}
