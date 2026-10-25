import { createSignal, For, Show } from "solid-js";
import type { GroupElement, LibraryChartData, LibraryChartKind, LibraryChartOptions, LibraryChartSeries } from "../model";
import { chartDataFromCsv, chartDataToCsv } from "../features/components/chart-import";
import { resizeLibraryGroup, setLibraryChartTrend } from "../features/components/library-component-editor";
import { defaultLibraryChartData, LIBRARY_COMPONENTS } from "../notes";
import "./chart-editor.css";

type Props = {
  group: () => GroupElement;
  isDraft: boolean;
  locked: () => boolean;
  onChangeGroup: (operation: (current: GroupElement) => GroupElement, componentId?: string, transient?: boolean) => void;
  onCommitTextEdit: (componentId?: string) => void;
};
type EditorTab = "data" | "style";
const PALETTES = [{ value: "blue", label: "Studio blue" }, { value: "ocean", label: "Ocean" }, { value: "warm", label: "Warm" }, { value: "violet", label: "Violet" }, { value: "mono", label: "Mono" }] as const;
const PALETTE_COLORS = {
  blue: ["#3977c3", "#2e9a7a", "#eda33a", "#8966bd", "#d6676d", "#4d9ca9", "#9a8058", "#657997"],
  ocean: ["#176b87", "#2d9c9a", "#55bd95", "#78b8d0", "#436f9e", "#70a77b", "#3c879a", "#a2c7c7"],
  warm: ["#c65d45", "#df8b36", "#e5ba4a", "#8c694d", "#d87977", "#a85e3f", "#8b7a52", "#b88963"],
  violet: ["#6548b6", "#9b66c8", "#4b79c1", "#38a38b", "#d18b42", "#c65d75", "#7d87bd", "#56a4b3"],
  mono: ["#24292e", "#59636d", "#7a848d", "#a1a8ae", "#4b6578", "#697c8b", "#8d9aa5", "#bec4c9"],
} as const;
const SERIES_TYPES = [{ value: "line", label: "Line" }, { value: "area", label: "Area" }, { value: "bar", label: "Bar" }, { value: "scatter", label: "Points" }] as const;
const CHART_KINDS: { value: LibraryChartKind; label: string }[] = [
  { value: "viz-bar", label: "Column" }, { value: "viz-horizontal-bar", label: "Horizontal bar" }, { value: "viz-stacked-bar", label: "Stacked bar" },
  { value: "viz-line", label: "Line" }, { value: "viz-area", label: "Area" }, { value: "viz-scatter", label: "Scatter" },
  { value: "viz-pie", label: "Pie" }, { value: "viz-donut", label: "Donut" }, { value: "viz-radar", label: "Radar" },
  { value: "viz-gauge", label: "Gauge" }, { value: "viz-funnel", label: "Funnel" }, { value: "viz-heatmap", label: "Heatmap" },
  { value: "viz-treemap", label: "Treemap" }, { value: "viz-kpi", label: "Metric" },
];

const valueFor = (group: GroupElement) => group.libraryComponent?.chartData ?? defaultLibraryChartData(group.libraryComponent?.kind as LibraryChartKind) ?? { labels: ["Item 1"], values: [0] };
const seriesFor = (data: LibraryChartData): LibraryChartSeries[] => data.series?.length ? data.series : [{ name: "Series 1", values: [...data.values] }];
const clampNumber = (value: number) => Number.isFinite(value) ? Math.max(-1_000_000_000, Math.min(1_000_000_000, value)) : 0;

export function ChartEditor(props: Props) {
  const [tab, setTab] = createSignal<EditorTab>("data");
  const [csvText, setCsvText] = createSignal("");
  const [csvError, setCsvError] = createSignal("");
  const [cellDrafts, setCellDrafts] = createSignal<Record<string, string>>({});
  const [seriesDrafts, setSeriesDrafts] = createSignal<Record<number, string>>({});
  const group = props.group;
  const chartData = () => valueFor(group());
  const kind = () => (group().libraryComponent?.kind ?? "viz-bar") as LibraryChartKind;
  const options = () => chartData().options ?? {};
  const dataSeries = () => seriesFor(chartData());
  const updateGroup = (current: GroupElement, operation: (data: LibraryChartData) => LibraryChartData) => {
    const next = operation(valueFor(current));
    const labels = next.labels.slice(0, 20).map(label => label.slice(0, 60));
    const series = next.series?.slice(0, 8).map((item, index) => ({
      ...item,
      name: item.name.slice(0, 60) || `Series ${index + 1}`,
      values: labels.map((_, valueIndex) => clampNumber(item.values[valueIndex] ?? 0)),
    }));
    const values = labels.map((_, index) => clampNumber(series?.[0]?.values[index] ?? next.values[index] ?? 0));
    const annotations = next.annotations?.slice(0, 32).filter(item => Number.isInteger(item.index) && item.index >= 0 && item.index < labels.length);
    return { ...current, libraryComponent: { ...current.libraryComponent!, chartData: { ...next, labels, values, ...(series ? { series } : {}), ...(annotations ? { annotations } : {}) } } };
  };
  const update = (operation: (data: LibraryChartData) => LibraryChartData) => props.onChangeGroup(current => updateGroup(current, operation));
  const editText = (event: Event, operation: (data: LibraryChartData) => LibraryChartData) => {
    if (props.isDraft) { update(operation); return; }
    const target = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
    const id = target.dataset.componentId ?? group().id ?? group().componentId;
    if (id) target.dataset.componentId = id;
    props.onChangeGroup(current => updateGroup(current, operation), id, true);
  };
  const finishTextEdit = (event: FocusEvent) => { if (!props.isDraft) props.onCommitTextEdit((event.currentTarget as HTMLElement).dataset.componentId); };
  const setOptions = (patch: Partial<LibraryChartOptions>) => update(data => ({ ...data, options: { ...data.options, ...patch } }));
  const setSeries = (operation: (series: LibraryChartSeries[], data: LibraryChartData) => LibraryChartSeries[]) => update(data => {
    const series = operation(seriesFor(data), data).slice(0, 8);
    return { ...data, series, values: series[0]?.values ?? data.values };
  });
  const cellKey = (seriesIndex: number, rowIndex: number) => `${seriesIndex}:${rowIndex}`;
  const cellOperation = (data: LibraryChartData, seriesIndex: number, rowIndex: number, value: number) => {
    const series = seriesFor(data).map((item, index) => index === seriesIndex ? { ...item, values: item.values.map((current, row) => row === rowIndex ? clampNumber(value) : current) } : item);
    return { ...data, series, values: series[0]?.values ?? data.values };
  };
  const applyCellValue = (seriesIndex: number, rowIndex: number, value: number, componentId?: string) => {
    if (props.isDraft) { update(data => cellOperation(data, seriesIndex, rowIndex, value)); return; }
    const id = componentId ?? group().id ?? group().componentId;
    props.onChangeGroup(current => updateGroup(current, data => cellOperation(data, seriesIndex, rowIndex, value)), id, true);
  };
  const editCell = (event: InputEvent & { currentTarget: HTMLInputElement }, seriesIndex: number, rowIndex: number) => {
    const target = event.currentTarget;
    const raw = target.value;
    const key = cellKey(seriesIndex, rowIndex);
    setCellDrafts(current => ({ ...current, [key]: raw }));
    if (!raw.trim()) { applyCellValue(seriesIndex, rowIndex, 0, target.dataset.componentId); return; }
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const id = target.dataset.componentId ?? group().id ?? group().componentId;
    if (id) target.dataset.componentId = id;
    applyCellValue(seriesIndex, rowIndex, value, id);
  };
  const editSeriesValues = (event: InputEvent & { currentTarget: HTMLInputElement }, seriesIndex: number) => {
    const raw = event.currentTarget.value;
    setSeriesDrafts(current => ({ ...current, [seriesIndex]: raw }));
    const currentValues = dataSeries()[seriesIndex]?.values ?? [];
    const values = chartData().labels.map((_, row) => {
      const token = raw.split(",")[row]?.trim();
      if (!token) return 0;
      const value = Number(token);
      return Number.isFinite(value) ? clampNumber(value) : currentValues[row] ?? 0;
    });
    setSeries((series, data) => series.map((item, index) => index === seriesIndex ? { ...item, values: data.labels.map((_, row) => values[row] ?? 0) } : item));
  };
  const finishSeriesValuesEdit = (event: FocusEvent, seriesIndex: number) => {
    const target = event.currentTarget as HTMLInputElement;
    setSeriesDrafts(current => { const next = { ...current }; delete next[seriesIndex]; return next; });
    if (!props.isDraft) props.onCommitTextEdit(target.dataset.componentId ?? group().id ?? group().componentId);
  };
  const finishCellEdit = (event: FocusEvent, seriesIndex: number, rowIndex: number) => {
    const target = event.currentTarget as HTMLInputElement;
    const key = cellKey(seriesIndex, rowIndex);
    const raw = cellDrafts()[key];
    if (raw !== undefined) {
      if (!raw.trim()) applyCellValue(seriesIndex, rowIndex, 0, target.dataset.componentId);
      setCellDrafts(current => { const next = { ...current }; delete next[key]; return next; });
    }
    if (!props.isDraft) props.onCommitTextEdit(target.dataset.componentId ?? group().id ?? group().componentId);
  };
  const addRow = () => update(data => ({ ...data, labels: [...data.labels, `Item ${data.labels.length + 1}`], values: [...data.values, 0], ...(data.series?.length ? { series: data.series.map(item => ({ ...item, values: [...item.values, 0] })) } : {}) }));
  const removeRow = (index: number) => update(data => ({
    ...data,
    labels: data.labels.filter((_, row) => row !== index),
    values: data.values.filter((_, row) => row !== index),
    ...(data.series?.length ? { series: data.series.map(item => ({ ...item, values: item.values.filter((_, row) => row !== index) })) } : {}),
    ...(data.annotations ? { annotations: data.annotations.flatMap(item => item.index === index ? [] : [{ ...item, index: item.index > index ? item.index - 1 : item.index }]) } : {}),
  }));
  const addSeries = () => setSeries((series, data) => [...series, { name: `Series ${series.length + 1}`, values: data.labels.map(() => 0) }]);
  const removeSeries = (seriesIndex: number) => {
    setSeries(series => series.filter((_, index) => index !== seriesIndex));
    setSeriesDrafts({});
  };
  const importCsv = () => {
    try {
      const parsed = chartDataFromCsv(csvText());
      const previousByName = new Map(dataSeries().map(series => [series.name, series]));
      update(data => {
        const series = (parsed.series ?? []).map(item => {
          const previous = previousByName.get(item.name);
          return { ...item, ...(previous?.chartType ? { chartType: previous.chartType } : {}), ...(previous?.axis ? { axis: previous.axis } : {}), ...(previous?.color ? { color: previous.color } : {}) };
        });
        return { ...data, ...parsed, values: series[0]?.values ?? parsed.values, series };
      });
      setCsvError("");
    } catch (cause) { setCsvError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const exportCsv = () => {
    const contents = chartDataToCsv(chartData());
    const url = URL.createObjectURL(new Blob([contents], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "sketchdraw-chart-data.csv"; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const changeKind = (nextKind: LibraryChartKind) => props.onChangeGroup(current => {
    const definition = LIBRARY_COMPONENTS.find(item => item.kind === nextKind);
    if (!definition) return current;
    const currentBounds = current.componentBounds ?? { x: 0, y: 0, w: definition.width, h: definition.height };
    const resized = resizeLibraryGroup(current, { ...currentBounds, w: definition.width, h: definition.height });
    return { ...resized, libraryComponent: { ...resized.libraryComponent!, kind: nextKind, label: definition.label, chartData: valueFor(current) } };
  });
  const setSeriesColor = (index: number, color: string) => setSeries(series => series.map((item, row) => row === index ? { ...item, color } : item));
  const resetSeriesColor = (index: number) => setSeries(series => series.map((item, row) => row === index ? { ...item, color: undefined } : item));
  const addAnnotation = () => update(data => ({ ...data, annotations: [...(data.annotations ?? []), { index: data.labels.length - 1, label: "Note" }].slice(0, 32) }));
  const setCategoryColor = (label: string, color: string) => setOptions({ categoryColors: { ...options().categoryColors, [label]: color } });
  const resetCategoryColor = (label: string) => {
    const categoryColors = { ...options().categoryColors };
    delete categoryColors[label];
    setOptions({ categoryColors: Object.keys(categoryColors).length ? categoryColors : undefined });
  };
  const setBackground = (value: string | null | undefined) => props.onChangeGroup(current => {
    const styleOverrides = { ...current.libraryComponent?.styleOverrides };
    if (value === undefined) delete styleOverrides.fillColor; else styleOverrides.fillColor = value;
    return { ...current, libraryComponent: { ...current.libraryComponent!, ...(Object.keys(styleOverrides).length ? { styleOverrides } : { styleOverrides: undefined }) } };
  });
  const applyTrend = (trend: "up" | "down" | "steady") => props.onChangeGroup(current => setLibraryChartTrend(current, trend));
  const trend = () => group().libraryComponent?.trendDirection ?? ((chartData().values[1] ?? 0) > 0 ? "up" : (chartData().values[1] ?? 0) < 0 ? "down" : "steady");
  const displayName = () => CHART_KINDS.find(item => item.value === kind())?.label ?? "Chart";

  return <section class="chart-workbench" aria-label={`${displayName()} editor`}>
    <label class="chart-workbench-type"><span>Chart type</span><select aria-label="Chart type" value={kind()} disabled={props.locked()} onChange={event => changeKind(event.currentTarget.value as LibraryChartKind)}><For each={CHART_KINDS}>{item => <option value={item.value}>{item.label}</option>}</For></select></label>
    <label class="chart-workbench-title">Title<input maxlength="80" value={chartData().title ?? "Chart"} disabled={props.locked()} onInput={event => editText(event, data => ({ ...data, title: event.currentTarget.value }))} onBlur={finishTextEdit}/></label>
    <div class="chart-workbench-tabs" role="tablist" aria-label="Chart editor sections"><button type="button" role="tab" aria-selected={tab() === "data"} classList={{ active: tab() === "data" }} onClick={() => setTab("data")}>Data <small>{chartData().labels.length}</small></button><button type="button" role="tab" aria-selected={tab() === "style"} classList={{ active: tab() === "style" }} onClick={() => setTab("style")}>Appearance</button></div>
    <Show when={tab() === "data"}>
      <div class="chart-workbench-panel" role="tabpanel" aria-label="Chart data">
        <div class="chart-workbench-toolbar"><div><strong>Data points</strong><small>{chartData().labels.length}/20</small></div><div><button type="button" disabled={props.locked() || chartData().labels.length >= 20} onClick={addRow}>Add data point</button><button type="button" disabled={props.locked() || dataSeries().length >= 8} onClick={addSeries}>Add series</button></div></div>
        <div class="chart-workbench-series-list" aria-label="Chart data series"><For each={dataSeries()}>{(series, index) => <div class="chart-workbench-series-row" classList={{ "has-values": index() > 0 }}><label><span>Series {index() + 1}</span><input aria-label={`Series ${index() + 1} name`} maxlength="60" value={series.name} disabled={props.locked()} onInput={event => editText(event, data => ({ ...data, series: seriesFor(data).map((item, current) => current === index() ? { ...item, name: event.currentTarget.value.slice(0, 60) } : item) }))} onBlur={finishTextEdit}/></label><Show when={index() > 0}><label class="chart-workbench-series-values"><span>Values</span><input aria-label={`Series ${index() + 1} values`} value={seriesDrafts()[index()] ?? series.values.join(", ")} disabled={props.locked()} onInput={event => editSeriesValues(event, index())} onBlur={event => finishSeriesValuesEdit(event, index())}/></label></Show><input type="color" aria-label={`Series ${index() + 1} color`} value={series.color ?? PALETTE_COLORS[options().palette ?? "blue"][index() % 8]} disabled={props.locked()} onInput={event => setSeriesColor(index(), event.currentTarget.value)}/><Show when={dataSeries().length > 1}><button type="button" aria-label={`Remove series ${index() + 1}`} disabled={props.locked()} onClick={() => removeSeries(index())}>×</button></Show></div>}</For></div>
        <div class="chart-workbench-data-table" aria-label="Chart data values"><div class="chart-workbench-data-row chart-workbench-data-row-heading"><span>Label</span><span>{dataSeries()[0]?.name || "Value"}</span><span></span></div><For each={chartData().labels}>{(label, row) => <div class="chart-workbench-data-row"><input aria-label={`Chart label ${row() + 1}`} maxlength="60" value={label} disabled={props.locked()} onInput={event => editText(event, data => ({ ...data, labels: data.labels.map((item, index) => index === row() ? event.currentTarget.value : item) }))} onBlur={finishTextEdit}/><input type="text" inputmode="decimal" aria-label={`${dataSeries()[0]?.name ?? "Series 1"} value for ${label || `category ${row() + 1}`}`} value={cellDrafts()[cellKey(0, row())] ?? String(dataSeries()[0]?.values[row()] ?? 0)} disabled={props.locked()} onInput={event => editCell(event, 0, row())} onBlur={event => finishCellEdit(event, 0, row())}/><button type="button" class="chart-workbench-remove-row" aria-label={`Remove ${label || `data point ${row() + 1}`}`} disabled={props.locked() || chartData().labels.length <= 1} onClick={() => removeRow(row())}>×</button></div>}</For></div>
        <details class="chart-workbench-csv"><summary>Import or export CSV</summary><p>Paste a header row and numeric columns. The first column becomes category labels.</p><textarea aria-label="Paste chart data as CSV" rows={5} maxlength={500000} value={csvText()} disabled={props.locked()} onInput={event => { setCsvText(event.currentTarget.value); setCsvError(""); }} placeholder={"Month,Actual,Target\nJan,42,50\nFeb,56,55"}/><div class="chart-workbench-csv-actions"><button type="button" disabled={props.locked() || !csvText().trim()} onClick={importCsv}>Apply CSV</button><button type="button" onClick={exportCsv}>Download current CSV</button></div><Show when={csvError()}><small class="chart-workbench-error">{csvError()}</small></Show></details>
        <Show when={kind() === "viz-kpi"}><div class="chart-workbench-trend"><span>Trend direction</span><div role="group" aria-label="Metric trend direction"><For each={[{ value: "up", label: "Rising" }, { value: "down", label: "Falling" }, { value: "steady", label: "Steady" }] as const}>{item => <button type="button" classList={{ active: trend() === item.value }} aria-pressed={trend() === item.value} disabled={props.locked()} onClick={() => applyTrend(item.value)}>{item.label}</button>}</For></div></div></Show>
      </div>
    </Show>
    <Show when={tab() === "style"}>
      <div class="chart-workbench-panel chart-workbench-style" role="tabpanel" aria-label="Chart appearance">
        <div class="chart-workbench-field-grid"><Show when={kind() !== "viz-pie" && kind() !== "viz-donut" && kind() !== "viz-kpi"}><label>X axis<input maxlength="80" value={chartData().xAxisLabel ?? ""} disabled={props.locked()} onInput={event => editText(event, data => ({ ...data, xAxisLabel: event.currentTarget.value }))} onBlur={finishTextEdit}/></label><label>Y axis<input maxlength="80" value={chartData().yAxisLabel ?? ""} disabled={props.locked()} onInput={event => editText(event, data => ({ ...data, yAxisLabel: event.currentTarget.value }))} onBlur={finishTextEdit}/></label><Show when={(kind() === "viz-line" || kind() === "viz-area") && dataSeries().some(item => item.axis === "secondary")}><label>Right axis<input maxlength="80" value={chartData().secondaryYAxisLabel ?? ""} disabled={props.locked()} onInput={event => editText(event, data => ({ ...data, secondaryYAxisLabel: event.currentTarget.value }))} onBlur={finishTextEdit}/></label></Show></Show></div>
        <label class="chart-workbench-property">Color palette<select value={options().palette ?? "blue"} disabled={props.locked()} onChange={event => setOptions({ palette: event.currentTarget.value as LibraryChartOptions["palette"] })}><For each={PALETTES}>{palette => <option value={palette.value}>{palette.label}</option>}</For></select></label>
        <label class="chart-workbench-property">Legend<select value={options().legend ?? "right"} disabled={props.locked()} onChange={event => setOptions({ legend: event.currentTarget.value as LibraryChartOptions["legend"] })}><option value="right">Right</option><option value="bottom">Bottom</option><option value="hidden">Hidden</option></select></label>
        <label class="chart-workbench-property">Category order<select value={options().sort ?? "original"} disabled={props.locked() || kind() === "viz-line" || kind() === "viz-area" || kind() === "viz-scatter"} onChange={event => setOptions({ sort: event.currentTarget.value as LibraryChartOptions["sort"] })}><option value="original">Source order</option><option value="ascending">Value: low to high</option><option value="descending">Value: high to low</option></select></label>
        <div class="chart-workbench-switches"><label><input type="checkbox" checked={options().showGrid !== false} disabled={props.locked()} onChange={event => setOptions({ showGrid: event.currentTarget.checked })}/><span>Show grid</span></label><label><input type="checkbox" checked={!!options().showValues} disabled={props.locked()} onChange={event => setOptions({ showValues: event.currentTarget.checked })}/><span>Show values</span></label><Show when={kind() === "viz-line" || kind() === "viz-area" || kind() === "viz-scatter"}><label><input type="checkbox" checked={options().showPoints !== false} disabled={props.locked()} onChange={event => setOptions({ showPoints: event.currentTarget.checked })}/><span>Show points</span></label></Show><Show when={kind() === "viz-line" || kind() === "viz-area"}><label><input type="checkbox" checked={options().smooth !== false} disabled={props.locked()} onChange={event => setOptions({ smooth: event.currentTarget.checked })}/><span>Smooth curves</span></label></Show></div>
        <Show when={kind() === "viz-line" || kind() === "viz-area" || kind() === "viz-scatter" || kind() === "viz-radar"}><label class="chart-workbench-range">Line width <input type="range" min="1" max="6" step="1" value={options().lineWidth ?? 2} disabled={props.locked()} onInput={event => setOptions({ lineWidth: Number(event.currentTarget.value) })}/><output>{options().lineWidth ?? 2}px</output></label><label class="chart-workbench-range">Point size <input type="range" min="3" max="16" step="1" value={options().pointSize ?? 7} disabled={props.locked()} onInput={event => setOptions({ pointSize: Number(event.currentTarget.value) })}/><output>{options().pointSize ?? 7}px</output></label></Show>
        <Show when={kind() === "viz-gauge"}><label class="chart-workbench-property">Gauge maximum<input type="number" min="1" max="1000000000" step="any" value={options().maxValue ?? 100} disabled={props.locked()} onChange={event => setOptions({ maxValue: Math.max(1, Number(event.currentTarget.value) || 100) })}/></label></Show>
        <Show when={kind() === "viz-pie" || kind() === "viz-donut" || kind() === "viz-bar" || kind() === "viz-horizontal-bar" || kind() === "viz-funnel" || kind() === "viz-treemap"}><section class="chart-workbench-category-colors"><strong>Category colors</strong><For each={chartData().labels}>{(label, index) => <label><span>{label}</span><input type="color" aria-label={`${label} color`} value={options().categoryColors?.[label] ?? PALETTE_COLORS[options().palette ?? "blue"][index() % 8]} disabled={props.locked()} onInput={event => setCategoryColor(label, event.currentTarget.value)}/><button type="button" disabled={props.locked() || !options().categoryColors?.[label]} onClick={() => resetCategoryColor(label)}>Palette</button></label>}</For></section></Show>
        <Show when={kind() === "viz-line" || kind() === "viz-area"}><section class="chart-workbench-series-style"><strong>Series style</strong><For each={dataSeries()}>{(series, index) => <div><span>{series.name}</span><input type="color" aria-label={`${series.name} series color`} value={series.color ?? PALETTE_COLORS[options().palette ?? "blue"][index() % 8]} disabled={props.locked()} onInput={event => setSeriesColor(index(), event.currentTarget.value)}/><button type="button" disabled={props.locked() || !series.color} onClick={() => resetSeriesColor(index())}>Palette</button><select aria-label={`${series.name} series type`} value={series.chartType ?? (kind() === "viz-area" ? "area" : "line")} disabled={props.locked()} onChange={event => setSeries(seriesList => seriesList.map((item, row) => row === index() ? { ...item, chartType: event.currentTarget.value as LibraryChartSeries["chartType"] } : item))}><For each={SERIES_TYPES}>{type => <option value={type.value}>{type.label}</option>}</For></select><select aria-label={`${series.name} axis`} value={series.axis ?? "primary"} disabled={props.locked()} onChange={event => setSeries(seriesList => seriesList.map((item, row) => row === index() ? { ...item, axis: event.currentTarget.value as LibraryChartSeries["axis"] } : item))}><option value="primary">Left axis</option><option value="secondary">Right axis</option></select></div>}</For></section></Show>
        <Show when={kind() === "viz-line" || kind() === "viz-area"}><section class="chart-workbench-annotations"><div><strong>Annotations</strong><button type="button" disabled={props.locked() || (chartData().annotations?.length ?? 0) >= 32} onClick={addAnnotation}>Add note</button></div><For each={chartData().annotations ?? []}>{(annotation, index) => <div><select aria-label={`Annotation ${index() + 1} category`} value={annotation.index} disabled={props.locked()} onChange={event => update(data => ({ ...data, annotations: (data.annotations ?? []).map((item, row) => row === index() ? { ...item, index: Number(event.currentTarget.value) } : item) }))}><For each={chartData().labels.map((_label, row) => row)}>{row => <option value={row}>{chartData().labels[row]}</option>}</For></select><input aria-label={`Annotation ${index() + 1} label`} maxlength="80" value={annotation.label} disabled={props.locked()} onInput={event => editText(event, data => ({ ...data, annotations: (data.annotations ?? []).map((item, row) => row === index() ? { ...item, label: event.currentTarget.value } : item) }))} onBlur={finishTextEdit}/><button type="button" aria-label={`Remove annotation ${index() + 1}`} disabled={props.locked()} onClick={() => update(data => ({ ...data, annotations: (data.annotations ?? []).filter((_item, row) => row !== index()) }))}>×</button></div>}</For></section></Show>
        <section class="chart-workbench-background"><strong>Chart surface</strong><label><span>Background</span><input type="color" aria-label="Chart background color" value={group().libraryComponent?.styleOverrides?.fillColor ?? "#ffffff"} disabled={props.locked() || group().libraryComponent?.styleOverrides?.fillColor === null} onInput={event => setBackground(event.currentTarget.value)}/><button type="button" disabled={props.locked()} onClick={() => setBackground(undefined)}>Theme</button><button type="button" disabled={props.locked()} onClick={() => setBackground(null)}>Transparent</button></label></section>
      </div>
    </Show>
  </section>;
}
