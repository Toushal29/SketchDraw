import { Show } from "solid-js";
import type { BlendMode, DropShadow, GradientFill, GradientStop, PatternFill, PatternFillType, Element, ShapeElement } from "../model";
import { BLEND_MODE_OPTIONS, DEFAULT_GRADIENT, DEFAULT_SHADOW, DEFAULT_PATTERN } from "../features/canvas/visual-effects";

type EffectValues = {
  gradientFill?: GradientFill;
  patternFill?: PatternFill;
  dropShadow?: DropShadow;
  blendMode?: BlendMode;
};

type Props = {
  element: () => (ShapeElement & EffectValues) | undefined;
  disabled: boolean;
  onGradientChange: (gradient: GradientFill | undefined) => void;
  onPatternChange: (pattern: PatternFill | undefined) => void;
  onShadowChange: (shadow: DropShadow | undefined) => void;
  onBlendModeChange: (mode: BlendMode) => void;
};

const GRADIENT_TYPES: { value: "linear" | "radial"; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
];

const PATTERN_TYPES: { value: PatternFillType; label: string }[] = [
  { value: "hatch", label: "Hatch" },
  { value: "crosshatch", label: "Cross" },
  { value: "dots", label: "Dots" },
  { value: "diagonal", label: "Diagonal" },
  { value: "horizontal-lines", label: "H-Lines" },
  { value: "vertical-lines", label: "V-Lines" },
];

export function VisualEffectsInspector(props: Props) {
  const gradient = () => props.element()?.gradientFill;
  const pattern = () => props.element()?.patternFill;
  const shadow = () => props.element()?.dropShadow;
  const blendMode = () => props.element()?.blendMode ?? "normal";

  return <section class="pane-section visual-effects-section">
    <div class="inspector-section-heading">Effects</div>

    {/* Gradient fill */}
    <div class="effect-toggle">
      <label class="component-state-control">
        <input type="checkbox" checked={!!gradient()} disabled={props.disabled}
          onChange={e => props.onGradientChange(e.currentTarget.checked ? DEFAULT_GRADIENT : undefined)} />
        <span class="component-switch" aria-hidden="true" />
        <strong>Gradient fill</strong>
      </label>
    </div>
    <Show when={gradient()}>{grad => <div class="effect-controls">
      <div class="property-label">Type
        <select value={grad().type} disabled={props.disabled}
          onChange={e => props.onGradientChange({ ...grad(), type: e.currentTarget.value as "linear" | "radial" })}>
          {GRADIENT_TYPES.map(t => <option value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <Show when={grad().type === "linear"}>
        <label class="property-label">Angle
          <input type="range" min="0" max="360" value={grad().angle ?? 0} disabled={props.disabled}
            onInput={e => props.onGradientChange({ ...grad(), angle: Number(e.currentTarget.value) })} />
          <span>{grad().angle ?? 0}°</span>
        </label>
      </Show>
      <div class="gradient-stops">
        {grad().stops.map((stop, index) =>
          <label class="gradient-stop">
            <input type="color" value={stop.color} disabled={props.disabled}
              onInput={e => {
                const stops = [...grad().stops];
                stops[index] = { ...stop, color: e.currentTarget.value };
                props.onGradientChange({ ...grad(), stops });
              }} />
            <input type="range" min="0" max="100" value={Math.round(stop.offset * 100)} disabled={props.disabled}
              onInput={e => {
                const stops = [...grad().stops];
                stops[index] = { ...stop, offset: Number(e.currentTarget.value) / 100 };
                props.onGradientChange({ ...grad(), stops });
              }} />
          </label>
        )}
      </div>
    </div>}</Show>

    {/* Pattern fill */}
    <div class="effect-toggle">
      <label class="component-state-control">
        <input type="checkbox" checked={!!pattern()} disabled={props.disabled}
          onChange={e => props.onPatternChange(e.currentTarget.checked ? DEFAULT_PATTERN : undefined)} />
        <span class="component-switch" aria-hidden="true" />
        <strong>Pattern fill</strong>
      </label>
    </div>
    <Show when={pattern()}>{pat => <div class="effect-controls">
      <div class="property-label">Pattern
        <select value={pat().type} disabled={props.disabled}
          onChange={e => props.onPatternChange({ ...pat(), type: e.currentTarget.value as PatternFillType })}>
          {PATTERN_TYPES.map(t => <option value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <label class="property-label">Color
        <input type="color" value={pat().color} disabled={props.disabled}
          onInput={e => props.onPatternChange({ ...pat(), color: e.currentTarget.value })} />
      </label>
      <label class="property-label">Spacing
        <input type="range" min="4" max="32" value={pat().spacing ?? 8} disabled={props.disabled}
          onInput={e => props.onPatternChange({ ...pat(), spacing: Number(e.currentTarget.value) })} />
        <span>{pat().spacing ?? 8}px</span>
      </label>
    </div>}</Show>

    {/* Drop shadow */}
    <div class="effect-toggle">
      <label class="component-state-control">
        <input type="checkbox" checked={!!shadow()} disabled={props.disabled}
          onChange={e => props.onShadowChange(e.currentTarget.checked ? DEFAULT_SHADOW : undefined)} />
        <span class="component-switch" aria-hidden="true" />
        <strong>Drop shadow</strong>
      </label>
    </div>
    <Show when={shadow()}>{shd => <div class="effect-controls">
      <label class="property-label">X offset
        <input type="range" min="-20" max="20" value={shd().offsetX} disabled={props.disabled}
          onInput={e => props.onShadowChange({ ...shd(), offsetX: Number(e.currentTarget.value) })} />
        <span>{shd().offsetX}px</span>
      </label>
      <label class="property-label">Y offset
        <input type="range" min="-20" max="20" value={shd().offsetY} disabled={props.disabled}
          onInput={e => props.onShadowChange({ ...shd(), offsetY: Number(e.currentTarget.value) })} />
        <span>{shd().offsetY}px</span>
      </label>
      <label class="property-label">Blur
        <input type="range" min="0" max="40" value={shd().blur} disabled={props.disabled}
          onInput={e => props.onShadowChange({ ...shd(), blur: Number(e.currentTarget.value) })} />
        <span>{shd().blur}px</span>
      </label>
      <label class="property-label">Color
        <input type="color" value={shd().color.startsWith("rgba") ? "#000000" : shd().color} disabled={props.disabled}
          onInput={e => props.onShadowChange({ ...shd(), color: e.currentTarget.value })} />
      </label>
    </div>}</Show>

    {/* Blend mode */}
    <div class="property-label">Blend mode
      <select value={blendMode()} disabled={props.disabled}
        onChange={e => props.onBlendModeChange(e.currentTarget.value as BlendMode)}>
        {BLEND_MODE_OPTIONS.map(opt => <option value={opt.value}>{opt.label}</option>)}
      </select>
    </div>
  </section>;
}
