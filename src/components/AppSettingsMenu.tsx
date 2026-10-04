import { AdvancedPropertiesIcon } from "./PropertyPanelIcons";

export type DisplayMetrics = {
  physicalWidth: number;
  physicalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
};

type Props = {
  interfaceScale: number;
  autosaveSeconds: 5 | 10;
  reduceMotion: boolean;
  displayMetrics: DisplayMetrics;
  onInterfaceScaleChange: (scale: number) => void;
  onAutosaveChange: (seconds: 5 | 10) => void;
  onReduceMotionChange: (reduce: boolean) => void;
  onRestoreDefaults: () => void;
  detailsRef?: (element: HTMLDetailsElement) => void;
  onToggle?: () => void;
};

const interfaceScales = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];

export function AppSettingsMenu(props: Props) {
  return (
    <details class="menu-dropdown settings-menu-dropdown" ref={props.detailsRef} onToggle={props.onToggle}>
      <summary aria-label="App settings" title="App settings">
        <AdvancedPropertiesIcon />
        <span class="settings-menu-label">Settings</span>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
      </summary>
      <div class="system-menu-popover app-settings-popover">
        <header class="app-settings-heading"><strong>App settings</strong><small>Adjust SketchDraw for this device</small></header>
        <label class="app-setting-field">
          <span>Interface scale <strong>{Math.round(props.interfaceScale * 100)}%</strong></span>
          <select aria-label="Interface scale" value={props.interfaceScale} onChange={event => props.onInterfaceScaleChange(Number(event.currentTarget.value))}>
            {interfaceScales.map(scale => <option value={scale}>{Math.round(scale * 100)}%</option>)}
          </select>
          <small>Changes the app's control and text size. Device display resolution is managed by system settings.</small>
        </label>
        <label class="app-setting-field">
          <span>Autosave interval</span>
          <select aria-label="Autosave interval" value={props.autosaveSeconds} onChange={event => props.onAutosaveChange(Number(event.currentTarget.value) as 5 | 10)}>
            <option value={5}>Every 5 seconds</option>
            <option value={10}>Every 10 seconds</option>
          </select>
        </label>
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
