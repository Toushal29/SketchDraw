import { createSignal, Show } from "solid-js";

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
  mobileSimple?: boolean;
  onFitDrawing: () => void;
  onFitSelection: () => void;
  onToggleGrid: () => void;
  onToggleSnapToGrid: () => void;
  onToggleSnapToObjects: () => void;
  onGroupSelection: () => void;
  appAppearance?: {
    themeMode: "system" | "light" | "dark";
    accentColor: string;
    toolbarColorChoice: string;
    accentOptions: { label: string; value: string }[];
    toolbarColorOptions: { label: string; value: string }[];
    onThemeChange: (mode: "system" | "light" | "dark") => void;
    onAccentChange: (value: string) => void;
    onToolbarColorChange: (value: string) => void;
  };
  canvasAppearance?: {
    backgroundColor: string;
    renderedBackgroundColor: string;
    followsTheme: boolean;
    boardLocked: boolean;
    boardColors: { value: string; label: string }[];
    paperPattern: "plain" | "dots" | "small-dots" | "lines" | "small-grid" | "ruled" | "isometric";
    onFollowTheme: () => void;
    onBackgroundColorChange: (color: string) => void;
    onPaperPatternChange: (pattern: "plain" | "dots" | "small-dots" | "lines" | "small-grid" | "ruled" | "isometric") => void;
  };
  canvasTools?: {
    showAlignmentGuides: boolean;
    showMinimap: boolean;
    autoLayoutDisabled?: boolean;
    presentation?: boolean;
    fullscreen?: boolean;
    onToggleAlignmentGuides: () => void;
    onToggleMinimap: () => void;
    onAutoLayout?: () => void;
    onValidateDiagram?: () => void;
    onSearchObjects?: () => void;
    validationDisabled?: boolean;
    onRenumberSequenceMessages?: () => void;
    sequenceNumberingDisabled?: boolean;
    onTogglePresentation?: () => void;
    onToggleFullscreen?: () => void;
  };
};

export function CanvasOptionsMenu(props: CanvasOptionsMenuProps) {
  const [showMoreCanvasTools, setShowMoreCanvasTools] = createSignal(false);
  const toggle = () => {
    props.onToggle();
    props.onCloseOtherTools();
  };

  return (
    <div class="canvas-options-family" classList={{ "options-open": props.open, "mobile-simple-mode": !!props.mobileSimple, "show-advanced-tools": showMoreCanvasTools() }}>
      <button
        type="button"
        class={`canvas-options-trigger ${props.open ? "active" : ""}`}
        aria-label="View"
        aria-haspopup="menu"
        aria-expanded={props.open}
        title="View"
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>
      </button>
      <div class="canvas-options-menu" role="menu" aria-label="View">
        <section class="canvas-options-section">
          <span>VIEW</span>
          <div class="canvas-options-grid">
            <button role="menuitem" disabled={!props.hasElements} title="Fit drawing (1)" onClick={props.onFitDrawing}><svg viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z" /></svg><span>Fit drawing</span><kbd>1</kbd></button>
            <button role="menuitem" disabled={!props.hasSelection} title="Fit selection (2)" onClick={props.onFitSelection}><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg><span>Fit selection</span><kbd>2</kbd></button>
            <button role="menuitemcheckbox" aria-checked={props.showGrid} class={props.showGrid ? "active" : ""} title="Toggle grid (G)" onClick={props.onToggleGrid}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 10h16M10 4v16" /></svg><span>Show grid</span><kbd>G</kbd></button>
          </div>
        </section>
        <Show when={props.mobileSimple}><button type="button" class="mobile-more-canvas-tools" aria-expanded={showMoreCanvasTools()} onClick={() => setShowMoreCanvasTools(value => !value)}>{showMoreCanvasTools() ? "Hide extra tools" : "More canvas tools"}<span aria-hidden="true">{showMoreCanvasTools() ? "−" : "+"}</span></button></Show>
        <Show when={props.canvasAppearance}>{appearance => <section class="canvas-options-section canvas-appearance-options mobile-advanced-canvas-tools">
          <span>VIEW</span>
          {props.appAppearance && <>
            <div class="canvas-appearance-heading">Theme</div>
            <select aria-label="Application theme" value={props.appAppearance.themeMode} onChange={event => props.appAppearance!.onThemeChange(event.currentTarget.value as "system" | "light" | "dark")}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
            <div class="canvas-appearance-heading">Accent color</div>
            <div class="canvas-view-color-row"><select aria-label="Accent color" value={props.appAppearance.accentColor} onChange={event => props.appAppearance!.onAccentChange(event.currentTarget.value)}>{props.appAppearance.accentOptions.map(option => <option value={option.value}>{option.label}</option>)}</select><label class="custom-color-swatch" title="Custom accent color"><input type="color" aria-label="Custom accent color" value={props.appAppearance.accentColor} onInput={event => props.appAppearance!.onAccentChange(event.currentTarget.value)} /></label></div>
            <div class="canvas-appearance-heading">Toolbar surface</div>
            <div class="canvas-view-color-row"><select aria-label="Toolbar surface" value={props.appAppearance.toolbarColorChoice} onChange={event => props.appAppearance!.onToolbarColorChange(event.currentTarget.value)}><option value="auto">Auto</option>{props.appAppearance.toolbarColorOptions.map(option => <option value={option.value}>{option.label}</option>)}</select><label class="custom-color-swatch" title="Custom toolbar surface"><input type="color" aria-label="Custom toolbar surface" value={props.appAppearance.toolbarColorChoice === "auto" ? "#ffffff" : props.appAppearance.toolbarColorChoice} onInput={event => props.appAppearance!.onToolbarColorChange(event.currentTarget.value)} /></label></div>
          </>}
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
            {props.canvasTools?.onRenumberSequenceMessages && <button role="menuitem" disabled={props.canvasTools.sequenceNumberingDisabled || props.boardLocked} title="Number the selected connectors in top to bottom order" onClick={() => props.canvasTools?.onRenumberSequenceMessages?.()}><svg viewBox="0 0 24 24"><path d="M4 6h4m-4 0 2-2v5m-2 5h4l-4 4h4m4-8h10m-10 5h10" /></svg><span>Number selected messages</span></button>}
          </div>
        </section>
        {props.canvasTools && <section class="canvas-options-section canvas-tools-options mobile-advanced-canvas-tools">
          <span>CANVAS TOOLS</span>
          <div class="canvas-options-grid">
            {props.canvasTools.onSearchObjects && <button role="menuitem" title="Find objects on the canvas (Ctrl+F)" onClick={props.canvasTools.onSearchObjects}><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5M7.5 10.5h6"/></svg><span>Find objects</span><kbd>Ctrl F</kbd></button>}
            {props.canvasTools.onValidateDiagram && <button role="menuitem" disabled={props.canvasTools.validationDisabled} title="Check links and schema references" onClick={props.canvasTools.onValidateDiagram}><svg viewBox="0 0 24 24"><path d="M5 12.5 9.5 17 19 7.5M4 3h16v18H4z" /></svg><span>Validate diagram</span></button>}
            <button role="menuitemcheckbox" aria-checked={props.canvasTools.showAlignmentGuides} class={props.canvasTools.showAlignmentGuides ? "active" : ""} title="Show or hide alignment guides while moving objects" onClick={props.canvasTools.onToggleAlignmentGuides}><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M7 7l10 10m0-10L7 17" /></svg><span>Alignment guides</span></button>
            <button role="menuitemcheckbox" aria-checked={props.canvasTools.showMinimap} class={props.canvasTools.showMinimap ? "active" : ""} title="Show or hide the minimap" onClick={props.canvasTools.onToggleMinimap}><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 16l4-5 3 3 2-2 3 4M7 8h.01" /></svg><span>Minimap</span></button>
            {props.canvasTools.onTogglePresentation && <button role="menuitemcheckbox" aria-checked={props.canvasTools.presentation ?? false} class={props.canvasTools.presentation ? "active" : ""} title={props.canvasTools.presentation ? "Exit presentation mode" : "Start presentation mode"} onClick={props.canvasTools.onTogglePresentation}><svg viewBox="0 0 24 24"><path d="m9 6 10 6-10 6z" /></svg><span>{props.canvasTools.presentation ? "Exit presentation" : "Presentation mode"}</span></button>}
            {props.canvasTools.onToggleFullscreen && <button role="menuitemcheckbox" aria-checked={props.canvasTools.fullscreen ?? false} class={props.canvasTools.fullscreen ? "active" : ""} title={props.canvasTools.fullscreen ? "Exit full screen focus mode" : "Enter full screen focus mode"} onClick={props.canvasTools.onToggleFullscreen}><svg viewBox="0 0 24 24"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4" /></svg><span>{props.canvasTools.fullscreen ? "Exit full screen" : "Full screen"}</span></button>}
          </div>
        </section>}
        {props.canvasTools?.onAutoLayout && <section class="canvas-options-section mobile-advanced-canvas-tools">
          <span>DIAGRAM LAYOUT</span>
          <div class="canvas-options-grid">
            <button role="menuitem" disabled={props.canvasTools.autoLayoutDisabled} title="Arrange connected objects from left to right" onClick={props.canvasTools.onAutoLayout}><svg viewBox="0 0 24 24"><path d="M3 5h6v5H3zM15 14h6v5h-6zM9 7.5h3a3 3 0 0 1 3 3V14m0 0-2.5-2.5M15 14l2.5-2.5" /></svg><span>Auto arrange</span></button>
          </div>
        </section>}
      </div>
    </div>
  );
}
