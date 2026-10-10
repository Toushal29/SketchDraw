import { Show } from "solid-js";

export type DisplayMetrics = {
  physicalWidth: number;
  physicalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};

type Props = {
  themeMode: "system" | "light" | "dark";
  accentColor: string;
  toolbarColorChoice: string;
  accentOptions: { label: string; value: string }[];
  toolbarColorOptions: { label: string; value: string }[];
  interfaceScale: number;
  autosaveSeconds: 5 | 10;
  thicknessPickerMode: "presets" | "stepper";
  buttonChoices: boolean;
  reduceMotion: boolean;
  displayMetrics: DisplayMetrics;
  onInterfaceScaleChange: (scale: number) => void;
  onThemeChange: (mode: "system" | "light" | "dark") => void;
  onAccentChange: (value: string) => void;
  onToolbarColorChange: (value: string) => void;
  onAutosaveChange: (seconds: 5 | 10) => void;
  onThicknessPickerModeChange: (mode: "presets" | "stepper") => void;
  onReduceMotionChange: (reduce: boolean) => void;
  onRestoreDefaults: () => void;
  detailsRef?: (element: HTMLDetailsElement) => void;
  onToggle?: () => void;
};

const interfaceScales = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];

function SettingChoices<T extends string | number>(props: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return <div class={`app-setting-choices ${props.label === "Interface scale" ? "app-setting-choices-scale" : ""} ${props.className ?? ""}`} role="group" aria-label={props.label}>
    {props.options.map(option => <button type="button" class={props.value === option.value ? "active" : ""} aria-pressed={props.value === option.value} onClick={() => props.onChange(option.value)}>{option.label}</button>)}
  </div>;
}

export function AppSettingsMenu(props: Props) {
  return (
    <details class="menu-dropdown settings-menu-dropdown" ref={props.detailsRef} onToggle={props.onToggle}>
      <summary aria-label="App settings" title="App settings">
        <span class="settings-menu-label">Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </summary>
      <div class="system-menu-popover app-settings-popover">
        <header class="app-settings-heading"><strong>App settings</strong><small>Preferences follow you across sketches.</small></header>
        <div class="app-setting-field">
          <span>Theme</span>
          <div class="app-setting-choices app-setting-choices-three" role="group" aria-label="Application theme">
            {([{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }] as const).map(option => <button type="button" class={props.themeMode === option.value ? "active" : ""} aria-pressed={props.themeMode === option.value} onClick={() => props.onThemeChange(option.value)}>{option.label}</button>)}
          </div>
        </div>
        <div class="app-setting-field">
          <span>Accent color</span>
          <div class="app-accent-choices" role="group" aria-label="Accent color">
            {props.accentOptions.map(option => <button type="button" class={props.accentColor === option.value ? "active" : ""} aria-pressed={props.accentColor === option.value} title={option.label} onClick={() => props.onAccentChange(option.value)}><i style={{ "background-color": option.value }} /><span>{option.label}</span></button>)}
            <label class="app-accent-custom" title="Choose a custom accent"><input type="color" aria-label="Custom accent color" value={props.accentColor} onInput={event => props.onAccentChange(event.currentTarget.value)} /><i style={{ "background-color": props.accentColor }} /><span>Custom</span></label>
          </div>
        </div>
        <div class="app-setting-field">
          <span>Toolbar surface</span>
          <div class="app-toolbar-choices" role="group" aria-label="Toolbar surface">
            <button type="button" class={props.toolbarColorChoice === "auto" ? "active" : ""} aria-pressed={props.toolbarColorChoice === "auto"} onClick={() => props.onToolbarColorChange("auto")}><i class="app-toolbar-auto" /><span>Auto</span></button>
            {props.toolbarColorOptions.map(option => <button type="button" class={props.toolbarColorChoice === option.value ? "active" : ""} aria-pressed={props.toolbarColorChoice === option.value} title={option.label} onClick={() => props.onToolbarColorChange(option.value)}><i style={{ "background-color": option.value }} /><span>{option.label}</span></button>)}
            <label class="app-toolbar-custom" title="Choose a custom toolbar color"><input type="color" aria-label="Custom toolbar color" value={props.toolbarColorChoice === "auto" ? "#ffffff" : props.toolbarColorChoice} onInput={event => props.onToolbarColorChange(event.currentTarget.value)} /><i style={{ "background-color": props.toolbarColorChoice === "auto" ? "#ffffff" : props.toolbarColorChoice }} /><span>Custom</span></label>
          </div>
        </div>
        <div class="app-setting-field">
          <span>Interface scale <strong>{Math.round(props.interfaceScale * 100)}%</strong></span>
          <Show when={props.buttonChoices} fallback={<select aria-label="Interface scale" value={props.interfaceScale} onChange={event => props.onInterfaceScaleChange(Number(event.currentTarget.value))}>{interfaceScales.map(scale => <option value={scale}>{Math.round(scale * 100)}%</option>)}</select>}>
            <SettingChoices label="Interface scale" value={props.interfaceScale} options={interfaceScales.map(scale => ({ value: scale, label: `${Math.round(scale * 100)}%` }))} onChange={props.onInterfaceScaleChange} />
          </Show>
          <small>Changes the app's control and text size. Device display resolution is managed by system settings.</small>
        </div>
        <div class="app-setting-field">
          <span>Autosave interval</span>
          <Show when={props.buttonChoices} fallback={<select aria-label="Autosave interval" value={props.autosaveSeconds} onChange={event => props.onAutosaveChange(Number(event.currentTarget.value) as 5 | 10)}><option value={5}>Every 5 seconds</option><option value={10}>Every 10 seconds</option></select>}>
            <SettingChoices label="Autosave interval" value={props.autosaveSeconds} options={[{ value: 5, label: "5 sec" }, { value: 10, label: "10 sec" }]} onChange={props.onAutosaveChange} />
          </Show>
        </div>
        <div class="app-setting-field">
          <span>Pen and brush thickness controls</span>
          <Show when={props.buttonChoices} fallback={<select aria-label="Pen and brush thickness controls" value={props.thicknessPickerMode} onChange={event => props.onThicknessPickerModeChange(event.currentTarget.value as "presets" | "stepper")}><option value="presets">Preset thicknesses</option><option value="stepper">Fine tune with slider</option></select>}>
            <SettingChoices label="Pen and brush thickness controls" value={props.thicknessPickerMode} options={[{ value: "presets", label: "Presets" }, { value: "stepper", label: "Fine tune" }]} onChange={props.onThicknessPickerModeChange} />
          </Show>
          <small>Choose presets or fine tuning for pen and paint brushes. Other tools keep their existing controls.</small>
        </div>
        <label class="app-setting-toggle">
          <span><strong>Reduce motion</strong><small>Turn off most interface animations</small></span>
          <input type="checkbox" checked={props.reduceMotion} onChange={event => props.onReduceMotionChange(event.currentTarget.checked)} />
        </label>
        <section class="app-display-info" aria-label="Display information">
          <strong>Current display</strong>
          <span>{props.displayMetrics.physicalWidth} x {props.displayMetrics.physicalHeight} px</span>
          <small>App viewport: {props.displayMetrics.viewportWidth} × {props.displayMetrics.viewportHeight} CSS px</small>
        </section>
        <button class="app-settings-reset" onClick={props.onRestoreDefaults}>Restore app defaults</button>
      </div>
    </details>
  );
}
