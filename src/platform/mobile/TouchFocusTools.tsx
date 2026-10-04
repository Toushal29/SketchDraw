import type { Tool } from "../../model";

type Props = {
  tool: Tool;
  onSelect: (tool: "pen" | "laser" | "eraser") => void;
  onExit: () => void;
};

export function TouchFocusTools(props: Props) {
  return (
    <nav class="touch-focus-tools" aria-label="Focus drawing tools">
      <button class={props.tool === "pen" ? "active" : ""} aria-label="Pen" aria-pressed={props.tool === "pen"} title="Pen" onClick={() => props.onSelect("pen")}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4-.8L19 8l-3-3L5 16l-1 4Zm10.5-13.5 3 3M4 20h16" /></svg>
      </button>
      <button class={props.tool === "laser" ? "active" : ""} aria-label="Laser pointer" aria-pressed={props.tool === "laser"} title="Laser pointer" onClick={() => props.onSelect("laser")}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 12-12m-5-1 6 6M15 3v2m6 4h-2M20 3l-1 1M8 3l1 1" /><circle cx="17" cy="7" r="2" /></svg>
      </button>
      <button class={props.tool === "eraser" ? "active" : ""} aria-label="Eraser" aria-pressed={props.tool === "eraser"} title="Eraser" onClick={() => props.onSelect("eraser")}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 14 9-10 9 9-8 8H7l-4-4a2 2 0 0 1 0-3Zm5 7 8-8" /></svg>
      </button>
      <span class="focus-tool-divider" aria-hidden="true" />
      <button class="focus-exit" aria-label="Exit full screen" title="Exit full screen" onClick={props.onExit}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8 4 4m0 4V4h4m8 0h4v4m-4 8 4 4m0-4v4h-4M8 16l-4 4m0-4v4h4" /></svg>
      </button>
    </nav>
  );
}
