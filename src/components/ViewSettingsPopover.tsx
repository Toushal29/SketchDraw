import { Show } from "solid-js";
import type { Theme } from "../model";
import type { CustomThemeTokens } from "../app/theme";

type ThemeOption = { value: Theme; label: string };
type WhiteboardStyle = "plain" | "dots" | "small-dots" | "lines" | "small-grid" | "ruled" | "isometric";
type ColorChoice = { label: string; value: string };

type CanvasToolToggles = {
  pressureCurve: boolean;
  onTogglePressureCurve: () => void;
};

type Props = {
  themeMode: Theme;
  themeOptions: ThemeOption[];
  customThemeTokens: CustomThemeTokens;
  onThemeChange: (theme: Theme) => void;
  onCustomTokenChange: (key: keyof CustomThemeTokens, color: string) => void;
  accentColor: string;
  toolbarColorChoice: string;
  accentOptions: ColorChoice[];
  toolbarColorOptions: ColorChoice[];
  boardColor: string;
  renderedBoardColor: string;
  boardColorUsesDefault: boolean;
  boardLocked: boolean;
  boardColors: ColorChoice[];
  paperPattern: WhiteboardStyle;
  patterns: { value: WhiteboardStyle; label: string }[];
  namedVersionsDisabled: boolean;
  canvasToolsDisabled: boolean;
  canvasTools?: CanvasToolToggles;
  accessibility?: {
    documentDisabled: boolean;
    onOpenOutline: () => void;
    onOpenNavigator: () => void;
  };
  onAccentChange: (value: string) => void;
  onToolbarColorChange: (value: string) => void;
  onBoardUseDefault: () => void;
  onBoardColorChange: (value: string) => void;
  onPaperPatternChange: (value: WhiteboardStyle) => void;
  onNamedVersions: () => void;
};

const CUSTOM_TOKEN_LABELS: { key: keyof CustomThemeTokens; label: string }[] = [
  { key: "background", label: "Background" },
  { key: "surface", label: "Surface" },
  { key: "surfaceElevated", label: "Panel" },
  { key: "surfaceInput", label: "Input" },
  { key: "border", label: "Border" },
  { key: "textPrimary", label: "Text" },
  { key: "textSecondary", label: "Muted text" },
  { key: "primary", label: "Accent" },
];

export function ViewSettingsPopover(props: Props) {
  return <div class="system-menu-popover view-popover view-settings-popover">
    {/* ── Appearance: theme + interface colors ── */}
    <section class="view-settings-section">
      <h3>Appearance</h3>
      <div class="app-settings-theme-grid" role="group" aria-label="Application theme">
        {props.themeOptions.map(option =>
          <button type="button" class={`app-settings-theme-btn ${props.themeMode === option.value ? "active" : ""}`} aria-pressed={props.themeMode === option.value} onClick={() => props.onThemeChange(option.value)}>
            <span class={`theme-preview theme-preview-${option.value}`} aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        )}
      </div>
      <Show when={props.themeMode === "custom"}>
        <div class="custom-theme-tokens">
          {CUSTOM_TOKEN_LABELS.map(({ key, label }) =>
            <label class="custom-theme-token">
              <span>{label}</span>
              <input type="color" value={props.customThemeTokens[key]} onInput={e => props.onCustomTokenChange(key, e.currentTarget.value)} />
            </label>
          )}
        </div>
      </Show>
      <div class="view-settings-row view-settings-color-row">
        <span>Accent</span>
        <div class="view-appearance-color-options" role="group" aria-label="Accent color">
          {props.accentOptions.map(option => <button type="button" class={props.accentColor === option.value ? "active" : ""} aria-label={option.label} aria-pressed={props.accentColor === option.value} title={option.label} onClick={() => props.onAccentChange(option.value)}><i style={{ background: option.value }} /></button>)}
          <label class="view-custom-color-choice" title="Choose a custom accent color"><i style={{ background: props.accentColor }} /><span>Custom</span><input type="color" aria-label="Custom accent color" value={props.accentColor} onInput={event => props.onAccentChange(event.currentTarget.value)} /></label>
        </div>
      </div>
      <div class="view-settings-row view-settings-color-row">
        <span>Toolbar surface</span>
        <div class="view-appearance-color-options" role="group" aria-label="Toolbar surface">
          <button type="button" class={props.toolbarColorChoice === "auto" ? "active" : ""} aria-label="Automatic toolbar surface" aria-pressed={props.toolbarColorChoice === "auto"} title="Auto" onClick={() => props.onToolbarColorChange("auto")}><i class="view-auto-color" /></button>
          {props.toolbarColorOptions.map(option => <button type="button" class={props.toolbarColorChoice === option.value ? "active" : ""} aria-label={option.label} aria-pressed={props.toolbarColorChoice === option.value} title={option.label} onClick={() => props.onToolbarColorChange(option.value)}><i style={{ background: option.value }} /></button>)}
          <label class="view-custom-color-choice" title="Choose a custom toolbar surface"><i style={{ background: props.toolbarColorChoice === "auto" ? "#ffffff" : props.toolbarColorChoice }} /><span>Custom</span><input type="color" aria-label="Custom toolbar surface" value={props.toolbarColorChoice === "auto" ? "#ffffff" : props.toolbarColorChoice} onInput={event => props.onToolbarColorChange(event.currentTarget.value)} /></label>
        </div>
      </div>
    </section>

    {/* ── Canvas: whiteboard + paper pattern ── */}
    <section class="view-settings-section">
      <h3>Canvas</h3>
      <div class="view-settings-row view-settings-color-row">
        <span>Whiteboard</span>
        <div class="view-appearance-color-options" role="group" aria-label="Whiteboard color">
          <button type="button" class={props.boardColorUsesDefault ? "active" : ""} aria-label="Default whiteboard color" aria-pressed={props.boardColorUsesDefault} disabled={props.boardLocked} title="Default" onClick={props.onBoardUseDefault}><i class="view-auto-color" /></button>
          {props.boardColors.map(option => <button type="button" class={!props.boardColorUsesDefault && props.boardColor === option.value ? "active" : ""} aria-label={option.label} aria-pressed={!props.boardColorUsesDefault && props.boardColor === option.value} disabled={props.boardLocked} title={option.label} onClick={() => props.onBoardColorChange(option.value)}><i style={{ background: option.value }} /></button>)}
          <label class="view-custom-color-choice" title="Choose a custom whiteboard color"><i style={{ background: props.renderedBoardColor }} /><span>Custom</span><input type="color" aria-label="Custom whiteboard color" value={props.renderedBoardColor} disabled={props.boardLocked} onInput={event => props.onBoardColorChange(event.currentTarget.value)} /></label>
        </div>
      </div>
      <div class="view-settings-patterns" aria-label="Paper pattern">
        <span>Paper pattern</span>
        <div>{props.patterns.map(option => <button type="button" class={props.paperPattern === option.value ? "active" : ""} aria-pressed={props.paperPattern === option.value} onClick={() => props.onPaperPatternChange(option.value)}><i class={`paper-pattern-swatch ${option.value}`} /><span>{option.label}</span></button>)}</div>
      </div>
    </section>

    {/* ── Drawing tools ── */}
    <Show when={props.canvasTools}>{tools => <section class="view-settings-section">
      <h3>Drawing tools</h3>
      <label class="view-settings-check"><input type="checkbox" checked={tools().pressureCurve} disabled={props.canvasToolsDisabled} onChange={tools().onTogglePressureCurve} /> Pressure curve editor</label>
    </section>}</Show>

    {/* ── Accessibility: navigation aids ── */}
    <Show when={props.accessibility}>{access => <section class="view-settings-section">
      <h3>Accessibility</h3>
      <button type="button" class="view-settings-action" disabled={access().documentDisabled} onClick={access().onOpenNavigator}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v16H3zM9 4v16M3 10h6"/></svg><span>Frame navigator</span><kbd>Alt+Shift+F</kbd></button>
      <button type="button" class="view-settings-action" disabled={access().documentDisabled} onClick={access().onOpenOutline}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9"/></svg><span>Document outline</span><kbd>Alt+Shift+O</kbd></button>
    </section>}</Show>

    {/* ── Document: versioning ── */}
    <section class="view-settings-section">
      <h3>Document</h3>
      <button type="button" class="view-settings-action" disabled={props.namedVersionsDisabled} onClick={props.onNamedVersions}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v15H4zM8 9h8m-8 4h5"/><path d="M7 3v4m10-4v4"/></svg>
        <span>Named versions</span><span aria-hidden="true">›</span>
      </button>
    </section>
  </div>;
}
