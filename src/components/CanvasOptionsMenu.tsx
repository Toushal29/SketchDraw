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
  windowsControls?: {
    showRulers: boolean;
    showAlignmentGuides: boolean;
    showMinimap: boolean;
    fullscreen: boolean;
    onToggleRulers: () => void;
    onToggleAlignmentGuides: () => void;
    onToggleMinimap: () => void;
    onToggleFullscreen: () => void;
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
        {props.windowsControls && <section class="canvas-options-section windows-canvas-options">
          <span>CANVAS TOOLS</span>
          <div class="canvas-options-grid">
            <button role="menuitemcheckbox" aria-checked={props.windowsControls.showRulers} class={props.windowsControls.showRulers ? "active" : ""} title="Show or hide canvas rulers" onClick={props.windowsControls.onToggleRulers}><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 4v5m4-5v3m4-3v5M4 8h5m-5 4h3m-3 4h5" /></svg><span>Rulers</span></button>
            <button role="menuitemcheckbox" aria-checked={props.windowsControls.showAlignmentGuides} class={props.windowsControls.showAlignmentGuides ? "active" : ""} title="Show or hide alignment guides while moving objects" onClick={props.windowsControls.onToggleAlignmentGuides}><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M7 7l10 10m0-10L7 17" /></svg><span>Alignment guides</span></button>
            <button role="menuitemcheckbox" aria-checked={props.windowsControls.showMinimap} class={props.windowsControls.showMinimap ? "active" : ""} title="Show or hide the minimap" onClick={props.windowsControls.onToggleMinimap}><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6 16l4-5 3 3 2-2 3 4M7 8h.01" /></svg><span>Minimap</span></button>
            <button role="menuitemcheckbox" aria-checked={props.windowsControls.fullscreen} class={props.windowsControls.fullscreen ? "active" : ""} title={props.windowsControls.fullscreen ? "Exit full screen focus mode" : "Enter full screen focus mode"} onClick={props.windowsControls.onToggleFullscreen}><svg viewBox="0 0 24 24"><path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4" /></svg><span>{props.windowsControls.fullscreen ? "Exit full screen" : "Full screen"}</span></button>
          </div>
        </section>}
      </div>
    </div>
  );
}
