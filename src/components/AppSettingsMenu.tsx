import { Show } from "solid-js";

export type DisplayMetrics = {
  physicalWidth: number;
  physicalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};

type Props = {
  interfaceScale: number;
  autosaveSeconds: 5 | 10;
  thicknessPickerMode: "presets" | "stepper";
  mobileButtonChoices: boolean;
  androidAllFilesAccessAvailable: boolean;
  androidAllFilesAccessGranted: boolean;
  showAndroidAllFilesAccess: boolean;
  reduceMotion: boolean;
  displayMetrics: DisplayMetrics;
  onInterfaceScaleChange: (scale: number) => void;
  onAutosaveChange: (seconds: 5 | 10) => void;
  onThicknessPickerModeChange: (mode: "presets" | "stepper") => void;
  onRequestAndroidAllFilesAccess: () => void;
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
}) {
  return <div class={`app-setting-choices ${props.label === "Interface scale" ? "app-setting-choices-scale" : ""}`} role="group" aria-label={props.label}>
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
        <header class="app-settings-heading"><strong>App settings</strong><small>Adjust SketchDraw for this device</small></header>
        <div class="app-setting-field">
          <span>Interface scale <strong>{Math.round(props.interfaceScale * 100)}%</strong></span>
          <Show when={props.mobileButtonChoices} fallback={<select aria-label="Interface scale" value={props.interfaceScale} onChange={event => props.onInterfaceScaleChange(Number(event.currentTarget.value))}>{interfaceScales.map(scale => <option value={scale}>{Math.round(scale * 100)}%</option>)}</select>}>
            <SettingChoices label="Interface scale" value={props.interfaceScale} options={interfaceScales.map(scale => ({ value: scale, label: `${Math.round(scale * 100)}%` }))} onChange={props.onInterfaceScaleChange} />
          </Show>
          <small>Changes the app's control and text size. Device display resolution is managed by system settings.</small>
        </div>
        <div class="app-setting-field">
          <span>Autosave interval</span>
          <Show when={props.mobileButtonChoices} fallback={<select aria-label="Autosave interval" value={props.autosaveSeconds} onChange={event => props.onAutosaveChange(Number(event.currentTarget.value) as 5 | 10)}><option value={5}>Every 5 seconds</option><option value={10}>Every 10 seconds</option></select>}>
            <SettingChoices label="Autosave interval" value={props.autosaveSeconds} options={[{ value: 5, label: "5 sec" }, { value: 10, label: "10 sec" }]} onChange={props.onAutosaveChange} />
          </Show>
        </div>
        <div class="app-setting-field">
          <span>Pen and brush thickness controls</span>
          <Show when={props.mobileButtonChoices} fallback={<select aria-label="Pen and brush thickness controls" value={props.thicknessPickerMode} onChange={event => props.onThicknessPickerModeChange(event.currentTarget.value as "presets" | "stepper")}><option value="presets">Preset thicknesses</option><option value="stepper">Fine tune with slider</option></select>}>
            <SettingChoices label="Pen and brush thickness controls" value={props.thicknessPickerMode} options={[{ value: "presets", label: "Presets" }, { value: "stepper", label: "Fine tune" }]} onChange={props.onThicknessPickerModeChange} />
          </Show>
          <small>Choose presets or fine tuning for pen and paint brushes. Other tools keep their existing controls.</small>
        </div>
        {props.showAndroidAllFilesAccess && <div class="app-setting-field app-android-storage-setting">
          <span>Android all files access <strong>{!props.androidAllFilesAccessAvailable ? "Unavailable" : props.androidAllFilesAccessGranted ? "Allowed" : "Not allowed"}</strong></span>
          <small>{props.androidAllFilesAccessAvailable ? "Android manages this special permission in Settings. You can allow or deny broad shared-storage access there. SketchDraw can still open and save files through Android's document picker when this is off." : "This special Android setting is available on Android 11 and later. The document picker remains available on this device."}</small>
          <button type="button" class="app-settings-reset" disabled={!props.androidAllFilesAccessAvailable} onClick={props.onRequestAndroidAllFilesAccess}>{props.androidAllFilesAccessGranted ? "Manage storage access" : "Choose storage access"}</button>
        </div>}
        <label class="app-setting-toggle">
          <span><strong>Reduce motion</strong><small>Turn off most interface animations</small></span>
          <input type="checkbox" checked={props.reduceMotion} onChange={event => props.onReduceMotionChange(event.currentTarget.checked)} />
        </label>
        <section class="app-display-info" aria-label="Display information">
          <strong>Current display</strong>
          <span>{props.displayMetrics.physicalWidth} × {props.displayMetrics.physicalHeight} px</span>
          <small>App viewport: {props.displayMetrics.viewportWidth} × {props.displayMetrics.viewportHeight} CSS px</small>
        </section>
        <button class="app-settings-reset" onClick={props.onRestoreDefaults}>Restore app defaults</button>
      </div>
    </details>
  );
}
