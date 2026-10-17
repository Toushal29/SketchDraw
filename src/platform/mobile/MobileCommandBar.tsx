import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import type { DisplayMetrics } from "../../components/AppSettingsMenu";
import { TOUCH_GESTURE_ACTIONS, TOUCH_TAP_ACTIONS, type OneFingerDragAction, type TouchGestureAction, type TouchTapAction } from "./GestureSettings";

type MenuPanel = "file" | "settings" | undefined;
type SettingsTab = "appearance" | "touch" | "help";

type Props = {
  fileName: string;
  hasFile: boolean;
  canSave: boolean;
  canSaveAs: boolean;
  canRename: boolean;
  canImport: boolean;
  canExport: boolean;
  canExportRetiredArchive: boolean;
  canClear: boolean;
  canClose: boolean;
  shortcuts: { newSketch: string; openSketch: string; saveSketch: string };
  onNewSketch: () => void;
  onOpenSketch: () => void;
  onNewPlan: () => void;
  onOpenPlan: () => void;
  onOpenAsView: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onRename: () => void;
  onImportImage: () => void;
  onImportSvg: () => void;
  onImportDiagram: () => void;
  onEmbedWeb: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onExportSvg: () => void;
  onExportDrawio: () => void;
  onExportExcalidraw: () => void;
  onExportRetiredArchive: () => void;
  onClearCanvas: () => void;
  onCloseFile: () => void;
  themeMode: "system" | "light" | "dark";
  accentColor: string;
  toolbarColorChoice: string;
  accentOptions: { label: string; value: string }[];
  toolbarColorOptions: { label: string; value: string }[];
  interfaceScale: number;
  mobileOrientation: "landscape" | "portrait";
  toolbarPosition: "top" | "bottom" | "left" | "right";
  orientationMessage: string;
  showMobileLayoutSettings: boolean;
  autosaveSeconds: 5 | 10;
  thicknessPickerMode: "presets" | "stepper";
  displayMetrics: DisplayMetrics;
  onInterfaceScaleChange: (scale: number) => void;
  onMobileOrientationChange: (orientation: "landscape" | "portrait") => void;
  onToolbarPositionChange: (position: "top" | "bottom" | "left" | "right") => void;
  onThemeChange: (mode: "system" | "light" | "dark") => void;
  onAccentChange: (value: string) => void;
  onToolbarColorChange: (value: string) => void;
  onAutosaveChange: (seconds: 5 | 10) => void;
  onThicknessPickerModeChange: (mode: "presets" | "stepper") => void;
  onRestoreDefaults: () => void;
  gestureSection: "taps" | "gestures";
  onGestureSectionChange: (section: "taps" | "gestures") => void;
  oneFingerTapAction: TouchTapAction;
  twoFingerTapAction: TouchTapAction;
  threeFingerTapAction: TouchTapAction;
  oneFingerDragAction: OneFingerDragAction;
  twoFingerGestureAction: TouchGestureAction;
  threeFingerGestureAction: TouchGestureAction;
  onTapChange: (fingers: "one" | "two" | "three", action: TouchTapAction) => void;
  onGestureChange: (fingers: 1 | 2 | 3, action: string) => void;
  onOpenGuide: () => void;
  onOpenShortcuts: () => void;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
  updateStatus: "idle" | "checking" | "current" | "available" | "permission" | "unavailable" | "installing" | "error";
  updateVersion: string;
  updateError: string;
  canInstallUpdate: boolean;
  appVersion: string;
};

const scales = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4];

function ChoiceRow<T extends string | number>(props: {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  return <div class="mobile-command-choice" role="group" aria-label={props.label}>
    {props.options.map(option => <button type="button" class={props.value === option.value ? "active" : ""} aria-pressed={props.value === option.value} onClick={() => props.onChange(option.value)}>{option.label}</button>)}
  </div>;
}

export function MobileCommandBar(props: Props) {
  const [panel, setPanel] = createSignal<MenuPanel>();
  const [settingsTab, setSettingsTab] = createSignal<SettingsTab>("appearance");
  let root: HTMLDivElement | undefined;
  let panelFrame = 0;
  const close = () => setPanel(undefined);
  const run = (action: () => void) => { close(); action(); };
  const toggle = (next: Exclude<MenuPanel, undefined>) => setPanel(current => current === next ? undefined : next);
  const fitPanelToViewport = () => {
    if (panelFrame) cancelAnimationFrame(panelFrame);
    panelFrame = requestAnimationFrame(() => {
      panelFrame = 0;
      const activePanel = panel();
      if (!activePanel) return;
      const trigger = root?.querySelector<HTMLElement>(activePanel === "file" ? ".mobile-file-trigger" : ".mobile-settings-trigger");
      const popover = root?.querySelector<HTMLElement>(activePanel === "file" ? ".mobile-file-dropdown" : ".mobile-settings-panel");
      if (!trigger || !popover) return;

      const viewport = window.visualViewport;
      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const scale = Math.max(0.5, props.interfaceScale);
      const edge = 8;
      const gap = 5;
      const anchor = trigger.getBoundingClientRect();
      const width = Math.min(activePanel === "file" ? 280 : 540, Math.max(0, viewportWidth - edge * 2));

      popover.style.setProperty("position", "fixed");
      popover.style.setProperty("z-index", "1800");
      popover.style.setProperty("box-sizing", "border-box");
      popover.style.setProperty("width", `${width / scale}px`);
      popover.style.setProperty("max-width", `${width / scale}px`);
      popover.style.setProperty("left", `${Math.max(viewportLeft + edge, Math.min(anchor.left, viewportLeft + viewportWidth - width - edge)) / scale}px`);
      popover.style.setProperty("right", "auto");
      popover.style.setProperty("bottom", "auto");
      popover.style.setProperty("margin", "0");
      popover.style.setProperty("transform", "none");

      const below = Math.max(0, viewportTop + viewportHeight - anchor.bottom - gap - edge);
      const above = Math.max(0, anchor.top - viewportTop - gap - edge);
      const opensBelow = below >= above || below >= 190;
      const availableHeight = Math.max(80, Math.min(viewportHeight - edge * 2, opensBelow ? below : above));
      popover.style.setProperty("max-height", `${availableHeight / scale}px`);
      const settingsContent = popover.querySelector<HTMLElement>(".mobile-settings-content");
      if (settingsContent) settingsContent.style.setProperty("max-height", `${Math.max(0, availableHeight - 112) / scale}px`);

      const measuredHeight = Math.min(popover.getBoundingClientRect().height || availableHeight, availableHeight);
      const top = opensBelow ? anchor.bottom + gap : anchor.top - measuredHeight - gap;
      popover.style.setProperty("top", `${Math.max(viewportTop + edge, Math.min(top, viewportTop + viewportHeight - measuredHeight - edge)) / scale}px`);
    });
  };

  createEffect(() => {
    panel();
    props.interfaceScale;
    fitPanelToViewport();
  });
  const fileActions = [
    { label: "New sketch", disabled: () => false, action: props.onNewSketch, shortcut: () => props.shortcuts.newSketch },
    { label: "Open sketch", disabled: () => false, action: props.onOpenSketch },
    { label: "New plan", disabled: () => false, action: props.onNewPlan },
    { label: "Open plan", disabled: () => false, action: props.onOpenPlan },
    { label: "Open view only", disabled: () => false, action: props.onOpenAsView },
    { label: "Save", disabled: () => !props.canSave, action: props.onSave, shortcut: () => props.shortcuts.saveSketch },
    { label: "Save as…", disabled: () => !props.canSaveAs, action: props.onSaveAs },
    { label: "Rename", disabled: () => !props.canRename, action: props.onRename },
    { label: "Import image", disabled: () => !props.canImport, action: props.onImportImage },
    { label: "Import SVG", disabled: () => !props.canImport, action: props.onImportSvg },
    { label: "Import diagram, CSV or DOT", disabled: () => !props.canImport, action: props.onImportDiagram },
    { label: "Embed web page", disabled: () => !props.canImport, action: props.onEmbedWeb },
    { label: "Export PNG", disabled: () => !props.canExport, action: props.onExportPng },
    { label: "Export PDF", disabled: () => !props.canExport, action: props.onExportPdf },
    { label: "Export SVG", disabled: () => !props.canExport, action: props.onExportSvg },
    { label: "Export draw.io", disabled: () => !props.canExport, action: props.onExportDrawio },
    { label: "Export Excalidraw", disabled: () => !props.canExport, action: props.onExportExcalidraw },
    ...(props.canExportRetiredArchive ? [{ label: "Export retired Library data", disabled: () => false, action: props.onExportRetiredArchive }] : []),
    { label: "Clear canvas", disabled: () => !props.canClear, action: props.onClearCanvas },
    { label: "Close file", disabled: () => !props.canClose, action: props.onCloseFile },
  ];

  onMount(() => {
    const outside = (event: PointerEvent) => { if (root && !root.contains(event.target as Node)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    const closeFromToolbar = () => close();
    const reposition = () => fitPanelToViewport();
    window.addEventListener("sketchdraw:close-touch-menu", closeFromToolbar);
    window.addEventListener("resize", reposition);
    window.addEventListener("orientationchange", reposition);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    onCleanup(() => {
      if (panelFrame) cancelAnimationFrame(panelFrame);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("sketchdraw:close-touch-menu", closeFromToolbar);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("orientationchange", reposition);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
    });
  });

  const settingTrigger = () => <button type="button" class={`mobile-command-trigger mobile-settings-trigger ${panel() === "settings" ? "active" : ""}`} aria-label="Settings" aria-expanded={panel() === "settings"} title="Settings" onClick={() => toggle("settings")}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7h-9m3 10H5m9-10a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm-10 0H4m16 0h-1m-6 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0Zm10 0h-7"/></svg>
    <span>Settings</span>
  </button>;

  return <div class="mobile-command-bar" ref={root}>
    <div class="mobile-command-actions" role="group" aria-label="File and application settings">
      <button type="button" class={`mobile-command-trigger mobile-file-trigger ${panel() === "file" ? "active" : ""}`} aria-label={`File menu${props.hasFile ? ` for ${props.fileName}` : ""}`} title={`File${props.hasFile ? `: ${props.fileName}` : ""}`} aria-expanded={panel() === "file"} aria-controls="mobile-file-menu" onClick={() => toggle("file")}>
        <span>File</span>
      </button>
      {settingTrigger()}
    </div>

    <Show when={panel() === "file"}>
      <nav id="mobile-file-menu" class="mobile-command-panel mobile-file-dropdown" aria-label="File actions">
        <div class="mobile-file-actions">
          {fileActions.map(item => <button type="button" disabled={item.disabled()} onClick={() => run(item.action)}>
            <span>{item.label}</span>
            {item.shortcut && <kbd>{item.shortcut()}</kbd>}
          </button>)}
        </div>
      </nav>
    </Show>

    <Show when={panel() === "settings"}>
      <section class="mobile-command-panel mobile-settings-panel" role="dialog" aria-label="Settings">
        <header><div><small>PREFERENCES</small><strong>Settings</strong></div><button type="button" class="mobile-command-close" aria-label="Close settings" onClick={close}>×</button></header>
        <nav class="mobile-settings-tabs" aria-label="Settings sections">
          <button class={settingsTab() === "appearance" ? "active" : ""} aria-pressed={settingsTab() === "appearance"} onClick={() => setSettingsTab("appearance")}>App</button>
          <button class={settingsTab() === "touch" ? "active" : ""} aria-pressed={settingsTab() === "touch"} onClick={() => setSettingsTab("touch")}>Touch</button>
          <button class={settingsTab() === "help" ? "active" : ""} aria-pressed={settingsTab() === "help"} onClick={() => setSettingsTab("help")}>Help &amp; updates</button>
        </nav>
        <div class="mobile-settings-content">
          <Show when={settingsTab() === "appearance"}>
            <section class="mobile-settings-section"><h3>Appearance</h3>
              <div class="mobile-settings-field"><span>Theme</span><ChoiceRow label="Application theme" value={props.themeMode} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} onChange={props.onThemeChange} /></div>
              <div class="mobile-settings-field"><span>Accent color</span><div class="mobile-color-options">{props.accentOptions.map(option => <button type="button" class={props.accentColor === option.value ? "active" : ""} aria-label={option.label} aria-pressed={props.accentColor === option.value} onClick={() => props.onAccentChange(option.value)}><i style={{ "background-color": option.value }} /></button>)}<label class="mobile-custom-color" title="Custom accent color"><input type="color" aria-label="Custom accent color" value={props.accentColor} onInput={event => props.onAccentChange(event.currentTarget.value)} /><i style={{ "background-color": props.accentColor }} /></label></div></div>
              <div class="mobile-settings-field"><span>Toolbar surface</span><div class="mobile-color-options"><button type="button" class={props.toolbarColorChoice === "auto" ? "active" : ""} aria-label="Automatic toolbar surface" aria-pressed={props.toolbarColorChoice === "auto"} onClick={() => props.onToolbarColorChange("auto")}><i class="mobile-color-auto" /></button>{props.toolbarColorOptions.map(option => <button type="button" class={props.toolbarColorChoice === option.value ? "active" : ""} aria-label={option.label} aria-pressed={props.toolbarColorChoice === option.value} onClick={() => props.onToolbarColorChange(option.value)}><i style={{ "background-color": option.value }} /></button>)}<label class="mobile-custom-color" title="Custom toolbar surface"><input type="color" aria-label="Custom toolbar surface" value={props.toolbarColorChoice === "auto" ? "#f8faf7" : props.toolbarColorChoice} onInput={event => props.onToolbarColorChange(event.currentTarget.value)} /><i style={{ "background-color": props.toolbarColorChoice === "auto" ? "#f8faf7" : props.toolbarColorChoice }} /></label></div></div>
            </section>
            <Show when={props.showMobileLayoutSettings}><section class="mobile-settings-section"><h3>Layout</h3>
              <div class="mobile-settings-field"><span>Screen orientation</span><ChoiceRow label="Screen orientation" value={props.mobileOrientation} options={[{ value: "landscape", label: "Landscape" }, { value: "portrait", label: "Portrait" }]} onChange={props.onMobileOrientationChange} />{props.orientationMessage && <small role="status">{props.orientationMessage}</small>}</div>
              <div class="mobile-settings-field"><span>Toolbar position</span><ChoiceRow label="Toolbar position" value={props.toolbarPosition} options={[{ value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }]} onChange={props.onToolbarPositionChange} /></div>
            </section></Show>
            <section class="mobile-settings-section"><h3>Application</h3>
              <label class="mobile-settings-field"><span>Interface scale <strong>{Math.round(props.interfaceScale * 100)}%</strong></span><select aria-label="Interface scale" value={props.interfaceScale} onChange={event => props.onInterfaceScaleChange(Number(event.currentTarget.value))}>{scales.map(scale => <option value={scale}>{Math.round(scale * 100)}%</option>)}</select></label>
              <label class="mobile-settings-field"><span>Autosave interval</span><select aria-label="Autosave interval" value={props.autosaveSeconds} onChange={event => props.onAutosaveChange(Number(event.currentTarget.value) as 5 | 10)}><option value={5}>Every 5 seconds</option><option value={10}>Every 10 seconds</option></select></label>
              <label class="mobile-settings-field"><span>Pen and brush thickness controls</span><select aria-label="Pen and brush thickness controls" value={props.thicknessPickerMode} onChange={event => props.onThicknessPickerModeChange(event.currentTarget.value as "presets" | "stepper")}><option value="presets">Preset thicknesses</option><option value="stepper">Fine tune with slider</option></select></label>
              <div class="mobile-display-info"><strong>Display</strong><span>{props.displayMetrics.physicalWidth} × {props.displayMetrics.physicalHeight} px</span><small>Viewport: {props.displayMetrics.viewportWidth} × {props.displayMetrics.viewportHeight} CSS px</small></div>
              <button class="mobile-settings-reset" onClick={props.onRestoreDefaults}>Restore app defaults</button>
            </section>
          </Show>

          <Show when={settingsTab() === "touch"}>
            <section class="mobile-settings-section"><h3>Touch gestures</h3><p class="mobile-settings-help">Choose what taps and finger movements do on the canvas.</p>
              <div class="mobile-touch-tabs"><button class={props.gestureSection === "taps" ? "active" : ""} aria-pressed={props.gestureSection === "taps"} onClick={() => props.onGestureSectionChange("taps")}>Tap actions</button><button class={props.gestureSection === "gestures" ? "active" : ""} aria-pressed={props.gestureSection === "gestures"} onClick={() => props.onGestureSectionChange("gestures")}>Finger movement</button></div>
              <Show when={props.gestureSection === "taps"}>
                <label class="mobile-settings-field"><span>One finger tap</span><select value={props.oneFingerTapAction} onChange={event => props.onTapChange("one", event.currentTarget.value as TouchTapAction)}>{TOUCH_TAP_ACTIONS.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
                <label class="mobile-settings-field"><span>Two finger tap</span><select value={props.twoFingerTapAction} onChange={event => props.onTapChange("two", event.currentTarget.value as TouchTapAction)}>{TOUCH_TAP_ACTIONS.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
                <label class="mobile-settings-field"><span>Three finger tap</span><select value={props.threeFingerTapAction} onChange={event => props.onTapChange("three", event.currentTarget.value as TouchTapAction)}>{TOUCH_TAP_ACTIONS.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
                <p class="mobile-settings-help">Tap actions run only when the fingers tap without moving.</p>
              </Show>
              <Show when={props.gestureSection === "gestures"}>
                <label class="mobile-settings-field"><span>One finger drag</span><select value={props.oneFingerDragAction} onChange={event => props.onGestureChange(1, event.currentTarget.value)}><option value="activeTool">Use active tool</option><option value="pan">Pan canvas</option></select></label>
                <label class="mobile-settings-field"><span>Two finger movement</span><select value={props.twoFingerGestureAction} onChange={event => props.onGestureChange(2, event.currentTarget.value)}>{TOUCH_GESTURE_ACTIONS.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
                <label class="mobile-settings-field"><span>Three finger movement</span><select value={props.threeFingerGestureAction} onChange={event => props.onGestureChange(3, event.currentTarget.value)}>{TOUCH_GESTURE_ACTIONS.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
                <p class="mobile-settings-help">Stylus input continues to use the active tool.</p>
              </Show>
            </section>
          </Show>

          <Show when={settingsTab() === "help"}>
            <section class="mobile-settings-section"><h3>Help</h3><button class="mobile-help-action" onClick={() => run(props.onOpenGuide)}>Open the guide <span>›</span></button><button class="mobile-help-action" onClick={() => run(props.onOpenShortcuts)}>Keyboard shortcuts <kbd>F1</kbd></button></section>
            <section class="mobile-settings-section"><h3>Updates</h3>
              <button class="mobile-update-check" disabled={props.updateStatus === "checking" || props.updateStatus === "installing"} onClick={props.onCheckForUpdates}>{props.updateStatus === "checking" ? "Checking for updates…" : "Check for updates"}</button>
              <div class="mobile-app-version"><span>Installed version</span><strong>{props.appVersion}</strong></div>
              <Show when={props.updateStatus === "current"}><p class="mobile-update-status current">SketchDraw is up to date.</p></Show>
              <Show when={props.updateStatus === "available"}><p class="mobile-update-status available">Version {props.updateVersion} is available.</p><Show when={props.canInstallUpdate}><button class="mobile-update-install" onClick={props.onInstallUpdate}>Download and install</button></Show></Show>
              <Show when={props.updateStatus === "permission"}><p class="mobile-update-status available">Allow SketchDraw to install apps in Android Settings. Return here, then continue the installation.</p><Show when={props.canInstallUpdate}><button class="mobile-update-install" onClick={props.onInstallUpdate}>Continue installation</button></Show></Show>
              <Show when={props.updateStatus === "unavailable"}><p class="mobile-update-status">The latest GitHub release does not include an Android APK.</p></Show>
              <Show when={props.updateStatus === "installing"}><p class="mobile-update-status available">Downloading version {props.updateVersion} and opening Android’s installer…</p></Show>
              <Show when={props.updateStatus === "error"}><p class="mobile-update-status error">{props.updateError || "The update could not be completed. Try again later."}</p></Show>
            </section>
          </Show>
        </div>
      </section>
    </Show>
  </div>;
}
