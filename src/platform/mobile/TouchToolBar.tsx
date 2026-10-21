import { Show, type JSX } from "solid-js";

type Props = {
  mobile: boolean;
  open: boolean;
  styleOpen: boolean;
  label?: string;
  showStyleToggle?: boolean;
  children: JSX.Element;
  quickStyles?: JSX.Element;
  layers?: JSX.Element;
  onShow: () => void;
  onHide: () => void;
  onToggleStyle: () => void;
};

const ReopenButton = (props: Pick<Props, "mobile" | "onShow">) => (
  <button class={props.mobile ? "tool-deck-reopen touch-tool-reopen" : "tool-deck-reopen"} title="Show tools" aria-label="Show tools" onClick={props.onShow}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 18h16M8 11l4 4 4-4" /></svg>
  </button>
);

/** Keeps the desktop tool deck intact and gives touch layouts separate rails and panels. */
export function TouchToolBar(props: Props) {
  return (
    <Show when={props.mobile} fallback={
      <div class="touch-tool-host">
        <Show when={props.open} fallback={<ReopenButton mobile={false} onShow={props.onShow} />}>
          <nav class="tool-deck" aria-label={props.label ?? "Canvas tools"}>
            <div class="touch-tool-content">{props.children}</div>
            <div class="touch-tool-actions">
              {props.quickStyles}
              <button class="tool-collapse" aria-label="Hide toolbar" title="Hide toolbar" onClick={props.onHide}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 13l4-4 4 4" /></svg>
              </button>
            </div>
          </nav>
        </Show>
      </div>
    }>
      <div class="touch-tool-host">
        <Show when={props.open} fallback={<ReopenButton mobile onShow={props.onShow} />}>
          <div class="touch-toolbar-layout">
            <nav class="touch-tool-bar" aria-label={props.label ?? "Canvas tools"}>
              <div class="touch-tool-content">{props.children}</div>
              <div class="touch-tool-actions">
                {props.showStyleToggle !== false && <button class={`touch-style-open ${props.styleOpen ? "active" : ""}`} title="Open advanced style panel" aria-label="Open advanced style panel" aria-expanded={props.styleOpen} aria-haspopup="dialog" onClick={props.onToggleStyle}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="11" cy="18" r="2"/></svg>
                </button>}
                {props.layers}
              </div>
            </nav>
            {props.quickStyles && <aside class="touch-quick-style-dock" aria-label="Quick style">{props.quickStyles}</aside>}
          </div>
        </Show>
      </div>
    </Show>
  );
}
