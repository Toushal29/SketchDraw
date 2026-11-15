import { Show, type JSX } from "solid-js";

type Props = {
  open: boolean;
  label: string;
  children: JSX.Element;
  customize?: boolean;
  onShow: () => void;
  onHide: () => void;
  onCustomize?: () => void;
};

export function WindowsToolBar(props: Props) {
  return <div class="desktop-tool-host">
    <Show when={props.open} fallback={<button class="tool-deck-reopen" title="Show tools" aria-label="Show tools" onClick={props.onShow}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 18h16M8 11l4 4 4-4" /></svg>
    </button>}>
      <nav class="tool-deck" aria-label={props.label}>
        <div class="desktop-tool-content">{props.children}</div>
        <div class="desktop-tool-actions">
          <Show when={props.customize && props.onCustomize}><button type="button" class="toolbar-customize-button" aria-label="Customize toolbar" title="Customize toolbar" onClick={props.onCustomize}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10m4 0h2M4 17h3m4 0h9M4 12h2m4 0h10"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="9" cy="17" r="2"/></svg><span>Customize</span>
          </button></Show>
          <button class="tool-collapse" aria-label="Hide toolbar" title="Hide toolbar" onClick={props.onHide}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16M8 13l4-4 4 4" /></svg>
          </button>
        </div>
      </nav>
    </Show>
  </div>;
}
