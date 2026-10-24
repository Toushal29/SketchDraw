type Props = {
  interfaceScale: number;
  mobileOrientation: "landscape" | "portrait";
  toolbarPosition: "top" | "bottom" | "left" | "right";
  orientationMessage: string;
  showMobileLayoutSettings: boolean;
  autosaveSeconds: 5 | 10;
  thicknessPickerMode: "presets" | "stepper";
  onInterfaceScaleChange: (scale: number) => void;
  onMobileOrientationChange: (orientation: Props["mobileOrientation"]) => void;
  onToolbarPositionChange: (position: Props["toolbarPosition"]) => void;
  onAutosaveChange: (seconds: 5 | 10) => void;
  onThicknessPickerModeChange: (mode: Props["thicknessPickerMode"]) => void;
  onRestoreDefaults: () => void;
  detailsRef?: (element: HTMLDetailsElement) => void;
  onToggle?: () => void;
};

function ButtonChoices<T extends string | number>(props: {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  return <div class="app-settings-choice"><span>{props.label}</span><div role="group" aria-label={props.label}>
    {props.options.map(option => <button type="button" class={props.value === option.value ? "active" : ""} aria-pressed={props.value === option.value} onClick={() => props.onChange(option.value)}>{option.label}</button>)}
  </div></div>;
}

const scales = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];

export function AppSettingsMenu(props: Props) {
  return <details class="menu-dropdown settings-menu-dropdown" ref={props.detailsRef} onToggle={props.onToggle}>
    <summary aria-label="App settings" title="App settings"><span class="settings-menu-label">Settings</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></summary>
    <div class="system-menu-popover app-settings-popover">
      <header class="app-settings-heading"><strong>Settings</strong></header>
      {props.showMobileLayoutSettings && <section class="app-settings-section">
        <strong>Mobile layout</strong>
        <ButtonChoices label="Orientation" value={props.mobileOrientation} options={[{ value: "landscape", label: "Landscape" }, { value: "portrait", label: "Portrait" }]} onChange={props.onMobileOrientationChange} />
        {props.orientationMessage && <small role="status">{props.orientationMessage}</small>}
        <ButtonChoices label="Toolbar position" value={props.toolbarPosition} options={[{ value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }]} onChange={props.onToolbarPositionChange} />
      </section>}
      <ButtonChoices label="Interface scale" value={props.interfaceScale} options={scales.map(scale => ({ value: scale, label: `${Math.round(scale * 100)}%` }))} onChange={props.onInterfaceScaleChange} />
      <ButtonChoices label="Autosave interval" value={props.autosaveSeconds} options={[{ value: 5, label: "5 sec" }, { value: 10, label: "10 sec" }]} onChange={props.onAutosaveChange} />
      <ButtonChoices label="Pen and brush thickness control" value={props.thicknessPickerMode} options={[{ value: "presets", label: "Presets" }, { value: "stepper", label: "Fine tune" }]} onChange={props.onThicknessPickerModeChange} />
      <button class="app-settings-reset" onClick={props.onRestoreDefaults}>Restore defaults</button>
    </div>
  </details>;
}
