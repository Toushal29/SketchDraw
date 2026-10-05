import { Show, type JSX } from "solid-js";

type Props = {
  open: boolean;
  expanded: boolean;
  styleOpen: boolean;
  children: JSX.Element;
  onShow: () => void;
  onHide: () => void;
  onToggleExpanded: () => void;
  onToggleStyle: () => void;
};

/** Touch-only toolbar frame around the shared tool buttons. */
export function TouchToolBar(props: Props) {
  return (
    <div class="touch-tool-host">
      <Show when={props.open} fallback={
        <button class="tool-deck-reopen touch-tool-reopen" title="Show tools" aria-label="Show tools" onClick={props.onShow}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 18h16M8 11l4 4 4-4" /></svg>
        </button>
      }>
        <nav class="tool-deck touch-tool-bar" aria-label="Canvas tools">
          <div class="touch-tool-content">{props.children}</div>
          <div class="touch-tool-actions">
            <button class={`touch-style-open ${props.styleOpen ? "active" : ""}`} title={props.styleOpen ? "Close tool style" : "Open tool style"} aria-label={props.styleOpen ? "Close tool style" : "Open tool style"} aria-expanded={props.styleOpen} aria-haspopup="dialog" onClick={props.onToggleStyle}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/></svg>
            </button>
            <button class="mobile-tools-toggle" title={props.expanded ? "Show essential tools only" : "Show all tools"} aria-label={props.expanded ? "Show essential tools only" : "Show all tools"} aria-expanded={props.expanded} onClick={props.onToggleExpanded}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={props.expanded ? "M5 12h14" : "M12 5v14M5 12h14"} /></svg>
              <span>{props.expanded ? "Less" : "More"}</span>
            </button>
            <button class="tool-collapse" aria-label="Hide toolbar" onClick={props.onHide}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 13l4-4 4 4" /></svg>
            </button>
          </div>
        </nav>
      </Show>
    </div>
  );
}
