import { Show } from "solid-js";

export type CanvasOptionsMenuProps = {
  open: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  snapToObjects: boolean;
  hasElements: boolean;
  hasSelection: boolean;
  canGroup: boolean;
  grouped: boolean;
  boardLocked: boolean;
  onToggle: () => void;
  onCloseOtherTools: () => void;
  onFitDrawing: () => void;
  onFitSelection: () => void;
  onToggleGrid: () => void;
  onToggleSnapToGrid: () => void;
  onToggleSnapToObjects: () => void;
  onGroupSelection: () => void;
  canvasAppearance?: {
    backgroundColor: string;
    renderedBackgroundColor: string;
    followsTheme: boolean;
    boardLocked: boolean;
    boardColors: { value: string; label: string }[];
    paperPattern: "plain" | "dots" | "small-dots" | "lines" | "small-grid" | "ruled" | "isometric";
    componentAppearance: "modern" | "simple";
    onFollowTheme: () => void;
    onBackgroundColorChange: (color: string) => void;
    onPaperPatternChange: (pattern: "plain" | "dots" | "small-dots" | "lines" | "small-grid" | "ruled" | "isometric") => void;
    onComponentAppearanceChange: (appearance: "modern" | "simple") => void;
  };
  canvasTools?: {
    showAlignmentGuides: boolean;
    showMinimap: boolean;
    presentation?: boolean;
    fullscreen?: boolean;
    onToggleAlignmentGuides: () => void;
    onToggleMinimap: () => void;
    onTogglePresentation?: () => void;
    onToggleFullscreen?: () => void;
  };
};

export function CanvasOptionsMenu(props: CanvasOptionsMenuProps) {
  const toggle = () => {
    props.onToggle();
    props.onCloseOtherTools();
  };

  return (
    <div class="canvas-options-family" classList={{ "options-open": props.open }}>
      <button
        type="button"
        class={`canvas-options-trigger ${props.open ? "active" : ""}`}
        aria-label="Canvas options"
        aria-haspopup="menu"
        aria-expanded={props.open}
        title="Canvas options"
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>
      </button>
      <div class="canvas-options-menu" role="menu" aria-label="Canvas options">
        <header class="canvas-options-heading"><strong>Canvas options</strong><small>View and organize your board</small></header>
        <section class="canvas-options-section">
          <span>VIEW</span>
          <div class="canvas-options-grid">
            <button role="menuitem" disabled={!props.hasElements} title="Fit drawing (1)" onClick={props.onFitDrawing}><svg viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z" /></svg><span>Fit drawing</span><kbd>1</kbd></button>
            <button role="menuitem" disabled={!props.hasSelection} title="Fit selection (2)" onClick={props.onFitSelection}><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><span>Fit selection</span><kbd>2</kbd></button>
            <button role="menuitemcheckbox" aria-checked={props.showGrid} class={props.showGrid ? "active" : ""} title="Toggle grid (G)" onClick={props.onToggleGrid}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 10h16M10 4v16" /></svg><span>Show grid</span><kbd>G</kbd></button>
          </div>
        </section>
        <Show when={props.canvasAppearance}>{appearance => <section class="canvas-options-section canvas-appearance-options">
          <span>APPEARANCE</span>
          <div class="canvas-appearance-heading">Whiteboard color</div>
          <div class="canvas-appearance-colors" role="group" aria-label="Whiteboard color">
            <button type="button" class={`canvas-color-choice ${appearance().followsTheme ? "active" : ""}`} aria-label="Automatic whiteboard color" aria-pressed={appearance().followsTheme} disabled={appearance().boardLocked} onClick={appearance().onFollowTheme}><i class="canvas-color-auto" /><span>Auto</span></button>
            {appearance().boardColors.map(option => <button type="button" class={`canvas-color-choice ${!appearance().followsTheme && appearance().backgroundColor === option.value ? "active" : ""}`} aria-label={option.label} aria-pressed={!appearance().followsTheme && appearance().backgroundColor === option.value} disabled={appearance().boardLocked} onClick={() => appearance().onBackgroundColorChange(option.value)}><i style={{ "background-color": option.value }} /><span>{option.label}</span></button>)}
            <label class="canvas-color-choice canvas-custom-color" title="Custom whiteboard color"><input type="color" aria-label="Custom whiteboard color" value={appearance().renderedBackgroundColor} disabled={appearance().boardLocked} onInput={event => appearance().onBackgroundColorChange(event.currentTarget.value)} /><i style={{ "background-color": appearance().renderedBackgroundColor }} /><span>Custom</span></label>
          </div>
          <div class="canvas-appearance-heading">Paper pattern</div>
          <div class="canvas-pattern-options" role="group" aria-label="Paper pattern">
            {([{ value: "plain", label: "Plain" }, { value: "dots", label: "Dots" }, { value: "small-dots", label: "Fine dots" }, { value: "lines", label: "Grid" }, { value: "small-grid", label: "Fine grid" }, { value: "ruled", label: "Ruled" }, { value: "isometric", label: "Isometric" }] as const).map(option => <button type="button" class={appearance().paperPattern === option.value ? "active" : ""} aria-pressed={appearance().paperPattern === option.value} onClick={() => appearance().onPaperPatternChange(option.value)}><i class={`paper-pattern-swatch ${option.value}`} /><span>{option.label}</span></button>)}
          </div>
          <div class="canvas-appearance-heading">Component style</div>
          <div class="canvas-component-appearance" role="group" aria-label="Component style">
            <button type="button" class={appearance().componentAppearance === "modern" ? "active" : ""} aria-pressed={appearance().componentAppearance === "modern"} onClick={() => appearance().onComponentAppearanceChange("modern")}>Modern</button>
            <button type="button" class={appearance().componentAppearance === "simple" ? "active" : ""} aria-pressed={appearance().componentAppearance === "simple"} onClick={() => appearance().onComponentAppearanceChange("simple")}>Simple</button>
          </div>
        </section>}</Show>
        <section class="canvas-options-section">
          <span>SNAPPING</span>
          <div class="canvas-options-grid">
            <button role="menuitemcheckbox" aria-checked={props.snapToGrid} class={props.snapToGrid ? "active" : ""} title="Snap to grid (Shift+G)" onClick={props.onToggleSnapToGrid}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8v8H8z" /></svg><span>Snap to grid</span><kbd>Shift G</kbd></button>
            <button role="menuitemcheckbox" aria-checked={props.snapToObjects} class={props.snapToObjects ? "active" : ""} title="Snap to objects (Shift+O)" onClick={props.onToggleSnapToObjects}><svg viewBox="0 0 24 24"><path d="M5 5h5v5H5zM14 14h5v5h-5zM10 7.5h4M16.5 10v4" /></svg><span>Snap to objects</span><kbd>Shift O</kbd></button>
          </div>
        </section>
        <section class="canvas-options-section">
          <span>SELECTION</span>
          <div class="canvas-options-grid">
            <button role="menuitem" disabled={!props.canGroup || props.boardLocked} class={props.grouped ? "active" : ""} title="Group or ungroup selection (Ctrl+G)" onClick={props.onGroupSelection}><svg viewBox="0 0 24 24"><rect x="3.5" y="4" width="9" height="9" rx="1.5" /><rect x="11.5" y="11" width="9" height="9" rx="1.5" /></svg><span>{props.grouped ? "Ungroup selection" : "Group selection"}</span><kbd>Ctrl G</kbd></button>
          </div>
        </section>
        {props.canvasTools && <section class="canvas-options-section canvas-tools-options">
          <span>CANVAS TOOLS</span>
          <div class="canvas-options-grid">
            <button role="menuitemcheckbox" aria-checked={props.canvasTools.showAlignmentGuides} class={props.canvasTools.showAlignmentGuides ? "active" : ""} title="Show or hide alignment guides while moving objects" onClick={props.canvasTools.onToggleAlignmentGuides}><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M7 7l10 10m0-10L7 17" /></svg><span>Alignment guides</span></button>
            <button role="menuitemcheckbox" aria-checked={props.canvasTools.showMinimap} class={props.canvasTools.showMinimap ? "active" : ""} title="Show or hide the minimap" onClick={props.canvasTools.onToggleMinimap}><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 16l4-5 3 3 2-2 3 4M7 8h.01" /></svg><span>Minimap</span></button>
            {props.canvasTools.onTogglePresentation && <button role="menuitemcheckbox" aria-checked={props.canvasTools.presentation ?? false} class={props.canvasTools.presentation ? "active" : ""} title={props.canvasTools.presentation ? "Exit presentation mode" : "Start presentation mode"} onClick={props.canvasTools.onTogglePresentation}><svg viewBox="0 0 24 24"><path d="m9 6 10 6-10 6z" /></svg><span>{props.canvasTools.presentation ? "Exit presentation" : "Presentation mode"}</span></button>}
            {props.canvasTools.onToggleFullscreen && <button role="menuitemcheckbox" aria-checked={props.canvasTools.fullscreen ?? false} class={props.canvasTools.fullscreen ? "active" : ""} title={props.canvasTools.fullscreen ? "Exit full screen focus mode" : "Enter full screen focus mode"} onClick={props.canvasTools.onToggleFullscreen}><svg viewBox="0 0 24 24"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4" /></svg><span>{props.canvasTools.fullscreen ? "Exit full screen" : "Full screen"}</span></button>}
          </div>
        </section>}
      </div>
    </div>
  );
}
