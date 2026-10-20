import type { ThemeMode } from "../model";

type WhiteboardStyle = "plain" | "dots" | "small-dots" | "lines" | "small-grid" | "ruled" | "isometric";
type ColorChoice = { label: string; value: string };

type Props = {
  themeMode: ThemeMode;
  accentColor: string;
  toolbarColorChoice: string;
  accentOptions: ColorChoice[];
  toolbarColorOptions: ColorChoice[];
  boardColor: string;
  renderedBoardColor: string;
  boardColorFollowsTheme: boolean;
  boardLocked: boolean;
  boardColors: ColorChoice[];
  paperPattern: WhiteboardStyle;
  patterns: { value: WhiteboardStyle; label: string }[];
  namedVersionsDisabled: boolean;
  onThemeChange: (mode: ThemeMode) => void;
  onAccentChange: (value: string) => void;
  onToolbarColorChange: (value: string) => void;
  onBoardFollowTheme: () => void;
  onBoardColorChange: (value: string) => void;
  onPaperPatternChange: (value: WhiteboardStyle) => void;
  onNamedVersions: () => void;
  onCustomizeToolbar: () => void;
};

export function ViewSettingsPopover(props: Props) {
  return <div class="system-menu-popover view-popover view-settings-popover">
    <header class="view-settings-heading">
      <div><span>VIEW</span><strong>Appearance and canvas</strong></div>
      <button type="button" class="view-settings-customize" onClick={props.onCustomizeToolbar}>Customize toolbar…</button>
    </header>
    <button type="button" class="view-settings-action" disabled={props.namedVersionsDisabled} onClick={props.onNamedVersions}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v15H4zM8 9h8m-8 4h5"/><path d="M7 3v4m10-4v4"/></svg>
      <span>Named document versions</span><span aria-hidden="true">›</span>
    </button>

    <section class="view-settings-section">
      <h3>App appearance</h3>
      <div class="view-settings-row">
        <span>Theme</span>
        <div class="view-theme-options" role="group" aria-label="Application theme">
          {([{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }] as const).map(option =>
            <button type="button" class={props.themeMode === option.value ? "active" : ""} aria-pressed={props.themeMode === option.value} onClick={() => props.onThemeChange(option.value)}>{option.label}</button>)}
        </div>
      </div>
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

    <section class="view-settings-section">
      <h3>Canvas appearance</h3>
      <div class="view-settings-row view-settings-color-row">
        <span>Whiteboard</span>
        <div class="view-appearance-color-options" role="group" aria-label="Whiteboard color">
          <button type="button" class={props.boardColorFollowsTheme ? "active" : ""} aria-label="Automatic whiteboard color" aria-pressed={props.boardColorFollowsTheme} disabled={props.boardLocked} title="Auto" onClick={props.onBoardFollowTheme}><i class="view-auto-color" /></button>
          {props.boardColors.map(option => <button type="button" class={!props.boardColorFollowsTheme && props.boardColor === option.value ? "active" : ""} aria-label={option.label} aria-pressed={!props.boardColorFollowsTheme && props.boardColor === option.value} disabled={props.boardLocked} title={option.label} onClick={() => props.onBoardColorChange(option.value)}><i style={{ background: option.value }} /></button>)}
          <label class="view-custom-color-choice" title="Choose a custom whiteboard color"><i style={{ background: props.renderedBoardColor }} /><span>Custom</span><input type="color" aria-label="Custom whiteboard color" value={props.renderedBoardColor} disabled={props.boardLocked} onInput={event => props.onBoardColorChange(event.currentTarget.value)} /></label>
        </div>
      </div>
      <div class="view-settings-patterns" aria-label="Paper pattern">
        <span>Paper pattern</span>
        <div>{props.patterns.map(option => <button type="button" class={props.paperPattern === option.value ? "active" : ""} aria-pressed={props.paperPattern === option.value} onClick={() => props.onPaperPatternChange(option.value)}><i class={`paper-pattern-swatch ${option.value}`} /><span>{option.label}</span></button>)}</div>
      </div>
    </section>
  </div>;
}
