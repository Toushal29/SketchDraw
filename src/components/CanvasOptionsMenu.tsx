import { Show } from "solid-js";
import type { DiagramLayoutAlgorithm } from "../features/diagrams/auto-layout";

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
  guiDesign?: {
    canCreateFrame: boolean;
    canCreateComponent: boolean;
    canArrange: boolean;
    hasSelectedFrame: boolean;
    hasFrames: boolean;
    onOpenLibrary: () => void;
    onCreateComponent: () => void;
    onArrangeSelection: () => void;
    onPresentFrames: () => void;
    onExportFrame: () => void;
  };
  onCreateFrame?: () => void;
  onSelectConnected?: () => void;
  onSelectSimilar?: () => void;
  onOrthogonalizeSelected?: () => void;
  structureSelectionDisabled?: boolean;
  orthogonalizeDisabled?: boolean;
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
  penInput?: {
    pressureWidth: boolean;
    tiltShaping: boolean;
    stylusEraserEnd: boolean;
    disabled: boolean;
    onPressureWidthChange: (enabled: boolean) => void;
    onTiltShapingChange: (enabled: boolean) => void;
    onStylusEraserEndChange: (enabled: boolean) => void;
  };
  canvasTools?: {
    showMinimap: boolean;
    orthogonalOnly?: boolean;
    autoLayoutDisabled?: boolean;
    layoutAlgorithm?: DiagramLayoutAlgorithm;
    layoutSelectionOnly?: boolean;
    layoutSpacing?: number;
    presentation?: boolean;
    fullscreen?: boolean;
    onToggleMinimap: () => void;
    onToggleOrthogonal?: () => void;
    onReattachDangling?: () => void;
    reattachDisabled?: boolean;
    onAutoLayout?: () => void;
    onLayoutAlgorithmChange?: (algorithm: DiagramLayoutAlgorithm) => void;
    onLayoutSelectionOnlyChange?: (selectionOnly: boolean) => void;
    onLayoutSpacingChange?: (spacing: number) => void;
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
  const toggle = () => { props.onToggle(); props.onCloseOtherTools(); };
  const check = (label: string, checked: boolean, run: () => void, disabled = false, shortcut?: string) => (
    <button type="button" class="workspace-view-toggle" role="menuitemcheckbox" aria-checked={checked} disabled={disabled} onClick={run}>
      <span>{label}{shortcut && <kbd>{shortcut}</kbd>}</span><i aria-hidden="true" />
    </button>
  );
  const action = (label: string, run: () => void, disabled = false, shortcut?: string) => (
    <button type="button" class="workspace-view-action" role="menuitem" disabled={disabled} onClick={run}>
      <span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );

  return (
    <div class="canvas-options-family" classList={{ "options-open": props.open }}>
      <button type="button" class={`canvas-options-trigger ${props.open ? "active" : ""}`} aria-label="View and canvas settings" aria-haspopup="dialog" aria-expanded={props.open} title="View and canvas settings" onClick={toggle}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></svg>
      </button>
      <div class="workspace-view-panel" role="dialog" aria-label="View and canvas settings">
        <header class="workspace-view-header"><strong>Canvas settings</strong></header>

        <div class="workspace-view-fit-row" aria-label="Zoom to content">
          <button type="button" disabled={!props.hasElements} onClick={props.onFitDrawing}><strong>Fit drawing</strong><kbd>1</kbd></button>
          <button type="button" disabled={!props.hasSelection} onClick={props.onFitSelection}><strong>Fit selection</strong><kbd>2</kbd></button>
        </div>

        <Show when={props.guiDesign}>
          {gui => <section class="workspace-view-section workspace-view-gui">
            <h2>UI design</h2>
            <div class="workspace-view-gui-actions">
              <button type="button" class="workspace-view-primary" onClick={gui().onOpenLibrary}>Open UI component library<span>Buttons · fields · cards · navigation</span></button>
              <div class="workspace-view-action-grid">
                <Show when={props.onCreateFrame}>{createFrame => <button type="button" disabled={!gui().canCreateFrame || props.boardLocked} onClick={createFrame()}>{gui().hasSelectedFrame ? "Create screen from selection" : "Create screen frame"}</button>}</Show>
                <button type="button" disabled={!gui().canCreateComponent || props.boardLocked} onClick={gui().onCreateComponent}>Create reusable component</button>
                <button type="button" disabled={!gui().canArrange || props.boardLocked} onClick={gui().onArrangeSelection}>Arrange selection</button>
                <button type="button" disabled={!gui().hasFrames} onClick={gui().onPresentFrames}>Present screens</button>
                <button type="button" disabled={!gui().hasSelectedFrame || props.boardLocked} onClick={gui().onExportFrame}>Export selected screen</button>
              </div>
            </div>
          </section>}
        </Show>

        <section class="workspace-view-section">
          <h2>Canvas aids</h2>
          <div class="workspace-view-controls">
            {check("Show grid", props.showGrid, props.onToggleGrid, false, "G")}
            {check("Snap to grid", props.snapToGrid, props.onToggleSnapToGrid, false, "Shift+G")}
            {check("Snap to objects", props.snapToObjects, props.onToggleSnapToObjects, false, "Shift+O")}
            {props.canvasTools?.onToggleOrthogonal && check("Orthogonal connectors", props.canvasTools.orthogonalOnly ?? false, props.canvasTools.onToggleOrthogonal, props.boardLocked)}
          </div>
        </section>

        <Show when={props.penInput}>
          {pen => <section class="workspace-view-section">
            <h2>Pen input</h2>
            <div class="workspace-view-controls">
              {check("Pressure width", pen().pressureWidth, () => pen().onPressureWidthChange(!pen().pressureWidth), pen().disabled)}
              {check("Tilt shaping", pen().tiltShaping, () => pen().onTiltShapingChange(!pen().tiltShaping), pen().disabled)}
              {check("Stylus eraser end", pen().stylusEraserEnd, () => pen().onStylusEraserEndChange(!pen().stylusEraserEnd), pen().disabled)}
            </div>
          </section>}
        </Show>

        <section class="workspace-view-section workspace-view-advanced">
          <h2>Movement and resize</h2>
          <p class="workspace-view-note">Hold Ctrl or Command while dragging to bypass snapping. Shift constrains movement or keeps proportions while resizing.</p>
        </section>

        <Show when={props.canvasAppearance || props.appAppearance}>
          <section class="workspace-view-section workspace-view-advanced">
            <h2>Appearance</h2>
            <Show when={props.appAppearance}>{appearance => <div class="workspace-view-fields">
              <label>Theme<select aria-label="Application theme" value={appearance().themeMode} onChange={event => appearance().onThemeChange(event.currentTarget.value as "system" | "light" | "dark")}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
              <label>Accent<select aria-label="Accent color" value={appearance().accentColor} onChange={event => appearance().onAccentChange(event.currentTarget.value)}>{appearance().accentOptions.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
              <label>Toolbar<select aria-label="Toolbar surface" value={appearance().toolbarColorChoice} onChange={event => appearance().onToolbarColorChange(event.currentTarget.value)}><option value="auto">Automatic</option>{appearance().toolbarColorOptions.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
            </div>}</Show>
            <Show when={props.canvasAppearance}>{appearance => <>
              <div class="workspace-view-color-row" aria-label="Board color">
                <button type="button" class={appearance().followsTheme ? "selected" : ""} disabled={appearance().boardLocked} onClick={appearance().onFollowTheme}>Theme</button>
                {appearance().boardColors.map(color => <button type="button" class={!appearance().followsTheme && appearance().backgroundColor === color.value ? "selected" : ""} aria-label={color.label} title={color.label} disabled={appearance().boardLocked} style={{ "--swatch-color": color.value }} onClick={() => appearance().onBackgroundColorChange(color.value)} />)}
                <label class="workspace-view-custom-color" title="Custom board color"><input type="color" aria-label="Custom board color" value={appearance().renderedBackgroundColor} disabled={appearance().boardLocked} onInput={event => appearance().onBackgroundColorChange(event.currentTarget.value)} /><i style={{ "--swatch-color": appearance().renderedBackgroundColor }} /></label>
              </div>
              <label class="workspace-view-fields">Paper pattern<select aria-label="Paper pattern" value={appearance().paperPattern} onChange={event => appearance().onPaperPatternChange(event.currentTarget.value as "plain" | "dots" | "small-dots" | "lines" | "small-grid" | "ruled" | "isometric")}><option value="plain">Plain</option><option value="dots">Dots</option><option value="small-dots">Fine dots</option><option value="lines">Grid</option><option value="small-grid">Fine grid</option><option value="ruled">Ruled</option><option value="isometric">Isometric</option></select></label>
            </>}</Show>
          </section>
        </Show>

        <section class="workspace-view-section workspace-view-advanced">
          <h2>Structure</h2>
          <div class="workspace-view-action-grid">
            {action(props.grouped ? "Ungroup selection" : "Group selection", props.onGroupSelection, !props.canGroup || props.boardLocked, "Ctrl+G")}
            {props.onSelectConnected && action("Select connected", props.onSelectConnected, !!props.structureSelectionDisabled || props.boardLocked)}
            {props.onSelectSimilar && action("Select similar", props.onSelectSimilar, !!props.structureSelectionDisabled || props.boardLocked)}
            {props.onOrthogonalizeSelected && action("Orthogonalize selected", props.onOrthogonalizeSelected, !!props.orthogonalizeDisabled || props.boardLocked)}
            {props.canvasTools?.onReattachDangling && action("Reattach dangling connectors", props.canvasTools.onReattachDangling, !!props.canvasTools.reattachDisabled || props.boardLocked)}
            {props.canvasTools?.onRenumberSequenceMessages && action("Number selected messages", props.canvasTools.onRenumberSequenceMessages, !!props.canvasTools.sequenceNumberingDisabled || props.boardLocked)}
          </div>
        </section>

        <Show when={props.canvasTools}>
          {tools => <section class="workspace-view-section workspace-view-advanced">
            <h2>Diagram tools</h2>
            <div class="workspace-view-fields workspace-view-tools">
              <Show when={tools().onAutoLayout}>{autoLayout => <>
                <label>Layout algorithm<select aria-label="Layout algorithm" value={tools().layoutAlgorithm ?? "layered"} onChange={event => tools().onLayoutAlgorithmChange?.(event.currentTarget.value as DiagramLayoutAlgorithm)}><option value="layered">Layered</option><option value="mrtree">Tree</option><option value="radial">Radial</option><option value="force">Force</option><option value="stress">Stress</option></select></label>
                <label class="workspace-view-range">Spacing <output>{tools().layoutSpacing ?? 48}</output><input aria-label="Layout spacing between elements" type="range" min="20" max="120" step="1" value={tools().layoutSpacing ?? 48} onPointerDown={event => event.stopPropagation()} onInput={event => tools().onLayoutSpacingChange?.(Number(event.currentTarget.value))} /></label>
                <label class="workspace-view-checkbox"><input type="checkbox" checked={tools().layoutSelectionOnly ?? false} disabled={tools().autoLayoutDisabled} onChange={event => tools().onLayoutSelectionOnlyChange?.(event.currentTarget.checked)} />Layout selection only</label>
                {action("Auto arrange", autoLayout(), !!tools().autoLayoutDisabled || !!tools().layoutSelectionOnly && !props.hasSelection)}
              </>}</Show>
              <Show when={tools().onSearchObjects}>{search => action("Find objects", search(), false, "Ctrl+F")}</Show>
              <Show when={tools().onValidateDiagram}>{validate => action("Validate diagram", validate(), !!tools().validationDisabled)}</Show>
              {check("Show minimap", tools().showMinimap, tools().onToggleMinimap)}
              <Show when={tools().onTogglePresentation}>{present => check(tools().presentation ? "Exit presentation" : "Presentation mode", !!tools().presentation, present())}</Show>
              <Show when={tools().onToggleFullscreen}>{fullscreen => action(tools().fullscreen ? "Exit full screen" : "Full screen focus", fullscreen())}</Show>
            </div>
          </section>}
        </Show>
      </div>
    </div>
  );
}
