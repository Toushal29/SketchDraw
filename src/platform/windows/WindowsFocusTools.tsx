import type { Tool } from "../../model";

type Props = { tool: Tool; readOnly: boolean; onSelect: (tool: Tool) => void; onExit: () => void };

const focusTools: { tool: Tool; label: string; path: string }[] = [
  { tool: "select", label: "Select", path: "M5 3v17l5-5 3 6 3-1-3-6h7z" },
  { tool: "pen", label: "Pen", path: "m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.5 7l3.5 3.5M4 20h16" },
  { tool: "laser", label: "Laser pointer", path: "m5 19 7-7m2-7 1-2m3 6 2-1M8 4 7 2m10 16 2 1M4 10l-2-1" },
  { tool: "eraser", label: "Eraser", path: "m4 14 8-9 8 8-6 7H8zM8 20h13" },
];

export function WindowsFocusTools(props: Props) {
  return <aside class="windows-focus-tools" aria-label="Full screen drawing tools">
    {focusTools.map(({ tool, label, path }) => <button type="button" class={props.tool === tool ? "active" : ""} aria-pressed={props.tool === tool} title={label} aria-label={label} disabled={props.readOnly && tool !== "laser" && tool !== "select"} onClick={() => props.onSelect(tool)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg></button>)}
    <span class="windows-focus-divider" />
    <button type="button" class="windows-focus-exit" title="Exit full screen (Esc)" aria-label="Exit full screen" onClick={props.onExit}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5m16 6v5h-5M4 4l6 6m10 10-6-6" /></svg></button>
  </aside>;
}
