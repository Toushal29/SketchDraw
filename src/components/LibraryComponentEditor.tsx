import { For, Show } from "solid-js";
import type { GroupElement } from "../model";
import { elementBounds } from "../features/canvas/bounds";
import {
  defaultLibraryChartData,
  defaultLibraryFormOptions,
  defaultLibraryFormTitle,
  type LibraryChartData,
  type LibraryComponentKind,
} from "../notes";
import {
  libraryComponentFields,
  libraryComponentFontSize,
  libraryComponentMinimum,
  libraryLifelineLength,
  rebuildLibraryFormOptions,
  resizeLibraryFont,
  resizeLibraryGroup,
  setLibraryChartTrend,
  setLibraryCheckboxOption,
  setLibraryComponentField,
  setLibraryFormState,
  setLibraryFormTitle,
  setLibraryLifelineLength,
  setLibraryPortCount,
  setLibraryRadioOption,
} from "../features/components/library-component-editor";

type Props = {
  group: () => GroupElement;
  isDraft: boolean;
  boardLocked: () => boolean;
  onChangeGroup: (operation: (current: GroupElement) => GroupElement) => void;
  onRememberFontSize: (size: number) => void;
  onCancelDraft: () => void;
  onCommitDraft: () => void;
};

export function LibraryComponentEditor(props: Props) {
  const group = props.group;
  const kind = () => group().libraryComponent?.kind ?? "custom";
  const hasEditableText = () => kind().startsWith("viz-") || kind().startsWith("form-") || libraryComponentFields(group()).some(field => field.value.trim().length > 0);
  const optionsFor = (component: GroupElement) => {
    const stored = component.libraryComponent?.formOptions;
    return stored?.length ? stored : defaultLibraryFormOptions(component.libraryComponent?.kind as LibraryComponentKind) ?? [];
  };
  const options = () => optionsFor(group());
  const chartData = () => group().libraryComponent?.chartData ?? defaultLibraryChartData(kind() as LibraryComponentKind) ?? { labels: ["Item 1"], values: [0] };
  const changeGroup = props.onChangeGroup;
  const changeComponentFontSize = (requestedSize: number) => {
    if (!Number.isFinite(requestedSize) || requestedSize < 8 || requestedSize > 160) return;
    props.onRememberFontSize(requestedSize);
    changeGroup(current => resizeLibraryFont(current, requestedSize));
  };
  const componentDimensions = () => group().componentBounds ?? elementBounds({ ...group(), rotation: 0 });
  const changeSize = (axis: "w" | "h", value: number) => {
    if (!Number.isFinite(value)) return;
    changeGroup(current => {
      const bounds = current.componentBounds ?? elementBounds({ ...current, rotation: 0 });
      return resizeLibraryGroup(current, { ...bounds, [axis]: Math.max(libraryComponentMinimum(current, axis), Math.min(4000, value)) });
    });
  };
  const changeOption = (index: number, value: string) => changeGroup(current => {
    const next = [...optionsFor(current)];
    next[index] = value.slice(0, 120);
    return rebuildLibraryFormOptions(current, next);
  });
  const changePortCount = (requested: number) => changeGroup(current => setLibraryPortCount(current, Math.max(1, Math.min(32, Math.round(requested)))));
  const changeLaneCount = (requested: number) => changeGroup(current => ({ ...current, libraryComponent: { ...current.libraryComponent!, laneCount: Math.max(2, Math.min(8, Math.round(requested))) } }));
  const changeDiagramTitle = (value: string) => changeGroup(current => ({ ...current, libraryComponent: { ...current.libraryComponent!, label: value.slice(0, 120) } }));
  const changeTaskDuration = (requested: number) => changeGroup(current => {
    const durationMinutes = Number.isFinite(requested) ? Math.max(0, Math.min(100000, requested)) : 0;
    return { ...current, libraryComponent: { ...current.libraryComponent!, durationMinutes } };
  });
  const changeSelectedOption = (index: number) => changeGroup(current => current.libraryComponent?.kind === "form-radio"
    ? setLibraryRadioOption(current, index)
    : rebuildLibraryFormOptions(current, optionsFor(current), index));
  const addOption = () => changeGroup(current => rebuildLibraryFormOptions(current, [...optionsFor(current), `Option ${optionsFor(current).length + 1}`]));
  const removeOption = () => changeGroup(current => rebuildLibraryFormOptions(current, optionsFor(current).slice(0, -1)));
  const updateChart = (operation: (data: LibraryChartData) => LibraryChartData) => changeGroup(current => {
    const previous = current.libraryComponent?.chartData ?? defaultLibraryChartData(current.libraryComponent?.kind as LibraryComponentKind)!;
    const next = operation(previous);
    const values = next.values.map(value => Number.isFinite(value) ? Math.max(-1_000_000_000, Math.min(1_000_000_000, value)) : 0);
    const series = next.series?.slice(0, 8).map((item, index) => ({ name: item.name.slice(0, 60) || `Series ${index + 1}`, values: next.labels.map((_, valueIndex) => { const value = item.values[valueIndex] ?? 0; return Number.isFinite(value) ? Math.max(-1_000_000_000, Math.min(1_000_000_000, value)) : 0; }) }));
    return { ...current, libraryComponent: { ...current.libraryComponent!, chartData: { ...next, values, ...(series ? { series } : {}) } } };
  });
  const chartOptions = () => chartData().options ?? {};
  const chartSeriesRows = () => {
    const data = chartData();
    return data.series?.length ? data.series : [{ name: "Series 1", values: data.values }];
  };
  const setChartOptions = (values: NonNullable<LibraryChartData["options"]>) => updateChart(data => ({ ...data, options: { ...data.options, ...values } }));
  const setChartSeriesName = (index: number, name: string) => updateChart(data => ({ ...data, series: (data.series ?? []).map((item, current) => current === index ? { ...item, name: name.slice(0, 60) } : item) }));
  const setChartSeriesValues = (index: number, text: string) => {
    const values = text.split(/[\s,;]+/).filter(Boolean).slice(0, 20).map(value => Number(value));
    updateChart(data => ({ ...data, series: (data.series ?? []).map((item, current) => current === index ? { ...item, values: data.labels.map((_, valueIndex) => Number.isFinite(values[valueIndex]) ? values[valueIndex] : 0) } : item) }));
  };
  const addChartSeries = () => updateChart(data => ({ ...data, series: [...(data.series?.length ? data.series : [{ name: "Series 1", values: [...data.values] }]), { name: `Series ${(data.series?.length ?? 1) + 1}`, values: data.labels.map(() => 0) }].slice(0, 8) }));
  const removeChartSeries = (index: number) => updateChart(data => ({ ...data, series: (data.series ?? []).filter((_, current) => current !== index) }));
  const setMetricTrend = (trendDirection: "up" | "down" | "steady") => changeGroup(current => setLibraryChartTrend(current, trendDirection));
  const updateMetricDatum = (index: number, value: number) => updateChart(data => {
    const labels = [...data.labels];
    const values = [...data.values];
    while (labels.length <= index) { labels.push(index === 0 ? "Value" : "Change"); values.push(0); }
    values[index] = value;
    return { ...data, labels, values };
  });
  const updateMetricCaption = (value: string) => updateChart(data => {
    const labels = [...data.labels];
    const values = [...data.values];
    while (labels.length < 2) { labels.push("Change"); values.push(0); }
    labels[1] = value;
    return { ...data, labels, values };
  });
  const locked = () => !props.isDraft && (props.boardLocked() || !!group().locked);

  return <div class="component-editor-content">
    <div class="precision-grid component-size-grid"><label>Width<input aria-label="Component width" type="number" min={libraryComponentMinimum(group(), "w")} max="4000" step="1" value={Math.round(componentDimensions().w)} disabled={locked()} onChange={event => changeSize("w", Number(event.currentTarget.value))} /></label><label>Height<input aria-label="Component height" type="number" min={libraryComponentMinimum(group(), "h")} max="4000" step="1" value={Math.round(componentDimensions().h)} disabled={locked()} onChange={event => changeSize("h", Number(event.currentTarget.value))} /></label><Show when={hasEditableText()}><label>Font<input aria-label="Component font size" type="number" min="8" max="160" value={libraryComponentFontSize(group())} disabled={locked()} onChange={event => changeComponentFontSize(Number(event.currentTarget.value))} /></label></Show></div>
    <Show when={kind() === "uml-lifeline"}><label class="property-label">Lifeline length<input aria-label="Lifeline length" type="number" min="24" max="4000" step="1" value={libraryLifelineLength(group())} disabled={locked()} onChange={event => changeGroup(current => setLibraryLifelineLength(current, Number(event.currentTarget.value)))} /></label></Show>
    <Show when={kind() === "bpmn-task"}><label class="property-label">Task duration (minutes)<input aria-label="BPMN task duration in minutes" type="number" min="0" max="100000" step="1" value={group().libraryComponent?.durationMinutes ?? 0} disabled={locked()} onChange={event => changeTaskDuration(Number(event.currentTarget.value))} /></label></Show>
    <Show when={kind() === "form-toggle"}>
      <label class="property-label component-form-title">Title<input aria-label="Toggle title" maxlength="80" value={group().libraryComponent?.formTitle ?? defaultLibraryFormTitle(kind() as LibraryComponentKind) ?? ""} disabled={locked()} onInput={event => changeGroup(current => setLibraryFormTitle(current, event.currentTarget.value))} /></label>
      <label class="component-state-control"><input type="checkbox" checked={group().libraryComponent?.formState ?? true} disabled={locked()} onChange={event => changeGroup(current => setLibraryFormState(current, event.currentTarget.checked))} /><span class="component-switch" aria-hidden="true" /><strong>{group().libraryComponent?.formState === false ? "Off" : "On"}</strong></label>
    </Show>
    <Show when={kind() === "network-switch" || kind() === "network-hub"}>
      <section class="component-port-editor"><div><strong>Visible ports</strong><small>Sets how many the symbol shows</small></div><label>Count<input aria-label="Number of visible hardware ports" type="number" min="1" max="32" step="1" value={group().libraryComponent?.portCount ?? (kind() === "network-hub" ? 8 : 6)} disabled={locked()} onChange={event => changePortCount(Number(event.currentTarget.value))} /></label></section>
    </Show>
    <Show when={kind() === "diagram-frame" || kind() === "diagram-swimlane"}>
      <label class="property-label">Title<input aria-label="Frame or swimlane title" maxlength="120" value={group().libraryComponent?.label ?? ""} disabled={locked()} onInput={event => changeDiagramTitle(event.currentTarget.value)} /></label>
      <Show when={kind() === "diagram-swimlane"}><label class="property-label">Lane count<input aria-label="Number of swimlanes" type="number" min="2" max="8" step="1" value={group().libraryComponent?.laneCount ?? 3} disabled={locked()} onChange={event => changeLaneCount(Number(event.currentTarget.value))} /></label></Show>
    </Show>
    <Show when={kind() === "form-radio" || kind() === "form-select" || kind() === "form-button" || kind() === "form-checkbox"}>
      <section class="component-options-editor">
        <header><strong>{kind() === "form-button" ? "Button choices" : kind() === "form-checkbox" ? "Checkbox options" : kind() === "form-radio" ? "Radio options" : "Select options"}</strong><span>{options().length}/12</span></header>
        <Show when={kind() === "form-checkbox" || kind() === "form-radio" || kind() === "form-select"}>
          <label class="property-label component-form-title">Title<input aria-label="Choice group title" maxlength="80" value={group().libraryComponent?.formTitle ?? defaultLibraryFormTitle(kind() as LibraryComponentKind) ?? ""} disabled={locked()} onInput={event => changeGroup(current => setLibraryFormTitle(current, event.currentTarget.value))} /></label>
        </Show>
        <div class="component-option-list"><For each={options().map((_, index) => index)}>{index => <div class="component-option-row">
          <span>{index + 1}</span>
          <Show when={kind() === "form-checkbox"}><input class="component-option-check" type="checkbox" aria-label={`Select ${options()[index] || `option ${index + 1}`}`} checked={group().libraryComponent?.formStates?.[index] ?? index === 0} disabled={locked()} onChange={event => changeGroup(current => setLibraryCheckboxOption(current, index, event.currentTarget.checked))} /></Show>
          <Show when={kind() === "form-radio"}><input class="component-option-radio" type="radio" name={`component-radio-${group().id}`} aria-label={`Choose ${options()[index] || `option ${index + 1}`}`} checked={(group().libraryComponent?.selectedOption ?? 0) === index} disabled={locked()} onChange={() => changeGroup(current => setLibraryRadioOption(current, index))} /></Show>
          <input aria-label={`Option ${index + 1} name`} maxlength="120" value={options()[index]} disabled={locked()} onInput={event => changeOption(index, event.currentTarget.value)} />
        </div>}</For></div>
        <div class="component-option-actions"><button type="button" disabled={locked() || options().length <= 1} onClick={removeOption}>Remove</button><button type="button" disabled={locked() || options().length >= 12} onClick={addOption}>Add option</button></div>
      </section>
      <Show when={kind() === "form-select" || kind() === "form-button"}><label class="property-label">Preview choice<select value={group().libraryComponent?.selectedOption ?? 0} disabled={locked()} onChange={event => changeSelectedOption(Number(event.currentTarget.value))}>{options().map((option, index) => <option value={index}>{option || `Option ${index + 1}`}</option>)}</select></label></Show>
    </Show>
    <Show when={kind().startsWith("viz-")}>
      <div class="component-chart-editor">
        <label class="property-label">{kind() === "viz-kpi" ? "Metric title" : "Chart title"}<input maxlength="80" value={chartData().title ?? "Chart"} disabled={locked()} onInput={event => updateChart(data => ({ ...data, title: event.currentTarget.value }))} /></label>
        <Show when={kind() !== "viz-kpi"}>
          <div class="component-chart-customize">
            <div class="component-chart-palette" role="group" aria-label="Chart color palette"><span>Colors</span>{([{ value: "blue", label: "Blue" }, { value: "ocean", label: "Ocean" }, { value: "warm", label: "Warm" }, { value: "violet", label: "Violet" }, { value: "mono", label: "Mono" }] as const).map(palette => <button type="button" class={chartOptions().palette === palette.value ? "active" : ""} aria-pressed={chartOptions().palette === palette.value} disabled={locked()} onClick={() => setChartOptions({ palette: palette.value })}>{palette.label}</button>)}</div>
            <div class="component-chart-setting" role="group" aria-label="Chart legend"><span>Legend</span>{([{ value: "right", label: "Right" }, { value: "bottom", label: "Bottom" }, { value: "hidden", label: "Off" }] as const).map(option => <button type="button" class={chartOptions().legend === option.value ? "active" : ""} aria-pressed={chartOptions().legend === option.value} disabled={locked()} onClick={() => setChartOptions({ legend: option.value })}>{option.label}</button>)}</div>
            <div class="component-chart-setting" role="group" aria-label="Chart display options"><span>Display</span><button type="button" class={chartOptions().showGrid !== false ? "active" : ""} aria-pressed={chartOptions().showGrid !== false} disabled={locked()} onClick={() => setChartOptions({ showGrid: chartOptions().showGrid === false })}>Grid</button><button type="button" class={chartOptions().showValues ? "active" : ""} aria-pressed={chartOptions().showValues === true} disabled={locked()} onClick={() => setChartOptions({ showValues: !chartOptions().showValues })}>Values</button><Show when={kind() === "viz-line" || kind() === "viz-area"}><button type="button" class={chartOptions().smooth !== false ? "active" : ""} aria-pressed={chartOptions().smooth !== false} disabled={locked()} onClick={() => setChartOptions({ smooth: chartOptions().smooth === false })}>Smooth</button></Show></div>
          </div>
        </Show>
        <Show when={kind() === "viz-line" || kind() === "viz-area" || kind() === "viz-radar" || kind() === "viz-scatter"}>
          <div class="component-chart-sliders">
            <Show when={kind() !== "viz-scatter"}><label class="component-chart-slider">Line width <input aria-label="Chart line width" type="range" min="1" max="6" step="1" value={chartOptions().lineWidth ?? 2} disabled={locked()} onInput={event => setChartOptions({ lineWidth: Number(event.currentTarget.value) })} /></label></Show>
            <label class="component-chart-slider">Point size <input aria-label="Chart point size" type="range" min="3" max="12" step="1" value={chartOptions().pointSize ?? (kind() === "viz-scatter" ? 8 : 6)} disabled={locked()} onInput={event => setChartOptions({ pointSize: Number(event.currentTarget.value) })} /></label>
          </div>
        </Show>
        <Show when={kind() === "viz-kpi"}>
          <div class="component-kpi-editor">
            <label class="property-label">Value<input aria-label="Metric value" type="number" step="any" value={chartData().values[0] ?? 0} disabled={locked()} onInput={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) updateMetricDatum(0, value); }} /></label>
            <label class="property-label">Change caption<input aria-label="Metric change caption" maxlength="60" value={chartData().labels[1] ?? "Change"} disabled={locked()} onInput={event => updateMetricCaption(event.currentTarget.value)} /></label>
            <label class="property-label">Change (%)<input aria-label="Metric change percent" type="number" step="any" value={chartData().values[1] ?? 0} disabled={locked()} onInput={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) updateMetricDatum(1, value); }} /></label>
          </div>
          <div class="component-trend-control" role="group" aria-label="Metric trend direction"><span>Trend direction</span><div>{([{ value: "up", label: "Rising" }, { value: "down", label: "Falling" }, { value: "steady", label: "Steady" }] as const).map(option => <button type="button" class={(group().libraryComponent?.trendDirection ?? ((chartData().values[1] ?? 0) > 0 ? "up" : (chartData().values[1] ?? 0) < 0 ? "down" : "steady")) === option.value ? "active" : ""} aria-pressed={(group().libraryComponent?.trendDirection ?? ((chartData().values[1] ?? 0) > 0 ? "up" : (chartData().values[1] ?? 0) < 0 ? "down" : "steady")) === option.value} disabled={locked()} onClick={() => setMetricTrend(option.value)}>{option.label}</button>)}</div></div>
        </Show>
        <Show when={kind() === "viz-gauge"}><label class="property-label">Maximum value<input aria-label="Gauge maximum value" type="number" min="1" step="any" value={chartOptions().maxValue ?? 100} disabled={locked()} onChange={event => setChartOptions({ maxValue: Math.max(1, Math.min(1_000_000_000, Number(event.currentTarget.value) || 100)) })} /></label></Show>
        <Show when={kind() === "viz-stacked-bar" || kind() === "viz-radar" || kind() === "viz-heatmap"}>
          <div class="component-chart-series-list">
            <div class="component-chart-data-heading"><strong>{kind() === "viz-heatmap" ? "Rows" : "Series"}</strong><span>{chartData().series?.length ?? 1}/8</span></div>
            <For each={chartSeriesRows()}>{(series, index) => <div class="component-chart-series-row"><input aria-label={`Series ${index() + 1} name`} maxlength="60" value={series.name} disabled={locked()} onChange={event => setChartSeriesName(index(), event.currentTarget.value)} /><input aria-label={`Series ${index() + 1} values`} value={series.values.join(", ")} disabled={locked()} onChange={event => setChartSeriesValues(index(), event.currentTarget.value)} /><button type="button" aria-label={`Remove series ${index() + 1}`} disabled={locked() || chartSeriesRows().length <= 1} onClick={() => removeChartSeries(index())}>×</button></div>}</For>
            <div class="component-option-actions"><button type="button" disabled={locked() || (chartData().series?.length ?? 1) >= 8} onClick={addChartSeries}>Add series</button></div>
          </div>
        </Show>
        <Show when={kind() !== "viz-pie" && kind() !== "viz-donut" && kind() !== "viz-kpi"}><div class="component-chart-axis-row"><label class="property-label">X axis<input maxlength="80" value={chartData().xAxisLabel ?? ""} disabled={locked()} onInput={event => updateChart(data => ({ ...data, xAxisLabel: event.currentTarget.value }))} /></label><label class="property-label">Y axis<input maxlength="80" value={chartData().yAxisLabel ?? ""} disabled={locked()} onInput={event => updateChart(data => ({ ...data, yAxisLabel: event.currentTarget.value }))} /></label></div></Show>
        <Show when={kind() !== "viz-kpi"}>
          <div class="component-chart-data">
            <div class="component-chart-data-heading"><strong>Data points</strong><span>{chartData().labels.length}/12</span></div>
            <div class="component-chart-row component-chart-row-heading"><span>{kind() === "viz-pie" || kind() === "viz-donut" ? "Category" : "Label"}</span><span>Value</span><span></span></div>
            <For each={chartData().labels.map((_, index) => index)}>{index => <div class="component-chart-row"><input aria-label={`Chart label ${index + 1}`} maxlength="60" value={chartData().labels[index]} disabled={locked()} onInput={event => updateChart(data => ({ ...data, labels: data.labels.map((label, current) => current === index ? event.currentTarget.value : label) }))} /><input aria-label={`Chart value ${index + 1}`} type="number" step="any" value={chartData().values[index]} disabled={locked()} onInput={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) updateChart(data => ({ ...data, values: data.values.map((currentValue, current) => current === index ? value : currentValue) })); }} /><button type="button" class="component-chart-remove" aria-label={`Remove data point ${index + 1}`} disabled={locked() || chartData().labels.length <= 1} onClick={() => updateChart(data => ({ ...data, labels: data.labels.filter((_, current) => current !== index), values: data.values.filter((_, current) => current !== index) }))}>×</button></div>}</For>
            <div class="component-option-actions"><button type="button" disabled={locked() || chartData().labels.length >= 12} onClick={() => updateChart(data => ({ ...data, labels: [...data.labels, `Item ${data.labels.length + 1}`], values: [...data.values, 0] }))}>Add data point</button></div>
          </div>
        </Show>
      </div>
    </Show>
    <Show when={libraryComponentFields(group()).length > 0}><div class="component-field-list"><For each={libraryComponentFields(group()).map(field => field.key)}>{key => { const field = () => libraryComponentFields(group()).find(entry => entry.key === key)!; return <label class="property-label"><span>{field().label}</span><textarea data-component-field-key={key} rows={Math.min(4, Math.max(1, field().value.split(/\r?\n/).length))} maxlength="2000" value={field().value} disabled={locked()} onInput={event => changeGroup(current => setLibraryComponentField(current, key, event.currentTarget.value))} /></label>; }}</For></div></Show>
    <Show when={props.isDraft}><div class="component-draft-actions"><button type="button" class="quiet-button" onClick={props.onCancelDraft}>Cancel</button><button type="button" class="save-button" disabled={props.boardLocked()} onClick={props.onCommitDraft}>Add to canvas</button></div></Show>
  </div>;
}
