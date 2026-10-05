import { createSignal, Show } from "solid-js";
import { Portal } from "solid-js/web";
import type { JSX } from "solid-js";

type WidthPreset = { value: number; label: string };
type WidthMode = "presets" | "fine" | "slider";

type Props = {
  orientation: "landscape" | "portrait";
  showColor: boolean;
  color: string;
  colorLabel: string;
  colors: readonly string[];
  showWidth: boolean;
  width: number;
  widthLabel: string;
  previewColor: string;
  widthMode: WidthMode;
  presets: readonly WidthPreset[];
  disabled: boolean;
  onColorChange: (value: string) => void;
  onWidthChange: (value: number) => void;
};

const MIN_WIDTH = 1;
const MAX_WIDTH = 24;

export function TouchQuickStyleControls(props: Props): JSX.Element {
  const [widthPanelOpen, setWidthPanelOpen] = createSignal(false);
  const [colorPanelOpen, setColorPanelOpen] = createSignal(false);
  const [widthPanelPosition, setWidthPanelPosition] = createSignal<{ top: string; left: string; transform: string }>();
  const [colorPanelPosition, setColorPanelPosition] = createSignal<{ top: string; left: string }>();
  let widthButton: HTMLButtonElement | undefined;
  let colorButton: HTMLButtonElement | undefined;
  const width = () => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(props.width)));
  const customColor = () => !props.colors.some(color => color.toLowerCase() === props.color.toLowerCase());
  const closeWidthPanel = (restoreFocus = false) => {
    setWidthPanelOpen(false);
    if (restoreFocus) requestAnimationFrame(() => widthButton?.focus());
  };
  const closeColorPanel = (restoreFocus = false) => {
    setColorPanelOpen(false);
    if (restoreFocus) requestAnimationFrame(() => colorButton?.focus());
  };
  const panelPosition = (button: HTMLButtonElement | undefined, maxWidth: number) => {
    if (!button || props.orientation === "portrait") return undefined;
    const bounds = button.getBoundingClientRect();
    const panelWidth = Math.min(maxWidth, window.innerWidth - 16);
    const left = Math.max(8, Math.min(bounds.left, window.innerWidth - panelWidth - 8));
    const top = Math.max(8, Math.min(bounds.bottom + 6, window.innerHeight - 110));
    return { top: `${top}px`, left: `${left}px` };
  };
  const selectColor = (value: string, close = false) => {
    props.onColorChange(value);
    if (close) closeColorPanel(true);
  };
  const colorOptions = (closeOnChange: boolean) => <>
    {props.colors.map(color => <button type="button" class={`touch-quick-color ${props.color.toLowerCase() === color.toLowerCase() ? "active" : ""}`} style={{ "--quick-color": color }} title={color} aria-label={`Use ${color} ${props.colorLabel.toLowerCase()}`} aria-pressed={props.color.toLowerCase() === color.toLowerCase()} disabled={props.disabled} onClick={() => selectColor(color, closeOnChange)} />)}
    <label class={`touch-quick-custom-color ${customColor() ? "active" : ""}`} style={{ "--quick-color": props.color }} title={`Custom ${props.colorLabel.toLowerCase()}`} aria-label={`Custom ${props.colorLabel.toLowerCase()}`}>
      <i>+</i>
      <input type="color" aria-label={`Choose custom ${props.colorLabel.toLowerCase()}`} value={props.color} disabled={props.disabled} onInput={event => selectColor(event.currentTarget.value)} onChange={event => { selectColor(event.currentTarget.value); if (closeOnChange) closeColorPanel(true); }} />
    </label>
  </>;
  const changeWidth = (value: number) => props.onWidthChange(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(value))));

  const quickStyleControls = <div class="touch-quick-style-controls" aria-label="Quick tool styles">
      <Show when={props.showColor}>
        <div class="touch-quick-colors" role="group" aria-label={props.colorLabel}>
          {colorOptions(false)}
        </div>
        <button ref={element => { colorButton = element; }} type="button" class={`touch-quick-color-toggle ${colorPanelOpen() ? "active" : ""}`} aria-haspopup="dialog" aria-expanded={colorPanelOpen()} aria-label={`${props.colorLabel}: ${props.color}`} title={`${props.colorLabel}: ${props.color}`} disabled={props.disabled} onClick={() => {
          setWidthPanelOpen(false);
          setColorPanelPosition(panelPosition(colorButton, 250));
          setColorPanelOpen(open => {
            if (!open) requestAnimationFrame(() => document.querySelector<HTMLElement>(".touch-quick-colors-dropdown")?.querySelector("button")?.focus());
            else requestAnimationFrame(() => colorButton?.focus());
            return !open;
          });
        }}>
          <i style={{ "--quick-color": props.color }} />
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </button>
      </Show>
      <Show when={props.showWidth}>
        <button ref={element => { widthButton = element; }} type="button" class={`touch-quick-width ${widthPanelOpen() ? "active" : ""}`} aria-haspopup="dialog" aria-expanded={widthPanelOpen()} aria-label={`${props.widthLabel}, ${width()} pixels`} title={`${props.widthLabel}: ${width()}px`} disabled={props.disabled} onClick={() => {
          setColorPanelOpen(false);
          const position = panelPosition(widthButton, 340);
          setWidthPanelPosition(position ? { ...position, transform: "none" } : undefined);
          setWidthPanelOpen(open => !open);
        }}>
          <i style={{ height: `${Math.max(1, Math.min(12, width()))}px`, background: props.previewColor }} />
          <span>{width()}px</span>
        </button>
      </Show>
      <Show when={colorPanelOpen() && props.showColor}>
        <Portal mount={document.querySelector<HTMLElement>(".app-shell") ?? document.body}>
          <div class="touch-quick-colors-scrim" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) closeColorPanel(); }} onKeyDown={event => { if (event.key === "Escape") closeColorPanel(true); }}>
            <div ref={element => requestAnimationFrame(() => element.querySelector("button")?.focus())} class="touch-quick-colors-dropdown" style={colorPanelPosition() ?? {}} role="dialog" aria-modal="false" aria-label={`${props.colorLabel} presets`} tabIndex={-1} onPointerDown={event => event.stopPropagation()}>
              {colorOptions(true)}
            </div>
          </div>
        </Portal>
      </Show>
      <Show when={widthPanelOpen()}>
        <Portal mount={document.querySelector<HTMLElement>(".app-shell") ?? document.body}>
          <div class="touch-quick-width-scrim" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) closeWidthPanel(); }} onKeyDown={event => { if (event.key === "Escape") closeWidthPanel(true); }}>
            <section ref={element => requestAnimationFrame(() => element.focus())} style={widthPanelPosition() ?? {}} class={`touch-quick-width-panel touch-quick-width-panel-${props.widthMode}`} role="dialog" aria-modal="false" aria-label={props.widthLabel} tabIndex={-1} onPointerDown={event => event.stopPropagation()}>
              <Show when={props.widthMode === "fine"}>
                <div class="touch-quick-width-fine-row">
                  <button type="button" aria-label="Decrease stroke width by one pixel" disabled={props.disabled || width() <= MIN_WIDTH} onClick={() => changeWidth(width() - 1)}>−</button>
                  <input aria-label="Fine stroke width" type="range" min={MIN_WIDTH} max={MAX_WIDTH} step="1" value={width()} disabled={props.disabled} onInput={event => changeWidth(Number(event.currentTarget.value))} />
                  <button type="button" aria-label="Increase stroke width by one pixel" disabled={props.disabled || width() >= MAX_WIDTH} onClick={() => changeWidth(width() + 1)}>+</button>
                  <div class="touch-quick-width-preview" aria-label={`Thickness preview, ${width()} pixels`}><i style={{ height: `${Math.max(1, Math.min(28, width() * 2))}px`, background: props.previewColor }} /><span>{width()} px</span></div>
                </div>
              </Show>
              <Show when={props.widthMode === "slider"}>
                <div class="touch-quick-width-slider-row">
                  <input aria-label={props.widthLabel} type="range" min={MIN_WIDTH} max={MAX_WIDTH} step="1" value={width()} disabled={props.disabled} onInput={event => changeWidth(Number(event.currentTarget.value))} />
                  <div class="touch-quick-width-preview" aria-label={`Thickness preview, ${width()} pixels`}><i style={{ height: `${Math.max(1, Math.min(28, width() * 2))}px`, background: props.previewColor }} /><span>{width()} px</span></div>
                </div>
              </Show>
              <Show when={props.widthMode === "presets"}>
                <div class="touch-quick-width-presets" role="group" aria-label={`${props.widthLabel} presets`}>
                  {props.presets.map(preset => <button type="button" class={width() === preset.value ? "active" : ""} aria-pressed={width() === preset.value} aria-label={`${preset.label}, ${preset.value} pixels`} disabled={props.disabled} onClick={() => { changeWidth(preset.value); closeWidthPanel(); }}>
                    <i style={{ height: `${Math.max(1, Math.min(12, preset.value))}px`, background: props.previewColor }} />
                    <span>{preset.value}px</span>
                  </button>)}
                </div>
              </Show>
            </section>
          </div>
        </Portal>
      </Show>
    </div>;

  return <Show when={props.showColor || props.showWidth}>
    {props.orientation === "landscape"
      ? <Portal mount={document.querySelector<HTMLElement>(".app-shell") ?? document.body}>{quickStyleControls}</Portal>
      : quickStyleControls}
  </Show>;
}
