type Props = {
  value: number;
  color: string;
  disabled?: boolean;
  sliderClassName?: string;
  onChange: (value: number) => void;
};

export function ThicknessTuner(props: Props) {
  return (
    <>
      <div class="thickness-tuner">
        <button type="button" aria-label="Decrease thickness by one pixel" disabled={props.disabled || props.value <= 1} onClick={() => props.onChange(props.value - 1)}>−</button>
        <div class="thickness-preview" aria-label={`Thickness preview, ${props.value} pixels`}>
          <i style={{ height: `${Math.max(1, Math.min(28, props.value * 2))}px`, background: props.color }} />
          <strong>{props.value.toFixed(1).replace(/\.0$/, "")} px</strong>
        </div>
        <button type="button" aria-label="Increase thickness by one pixel" disabled={props.disabled || props.value >= 24} onClick={() => props.onChange(props.value + 1)}>+</button>
      </div>
      <label class="thickness-fine-slider">Fine adjustment<input class={props.sliderClassName} aria-label="Fine thickness adjustment" type="range" min="1" max="24" step="1" value={props.value} disabled={props.disabled} onInput={event => props.onChange(Number(event.currentTarget.value))} /></label>
    </>
  );
}
