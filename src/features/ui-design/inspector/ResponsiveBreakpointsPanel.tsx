import { For, Show } from "solid-js";
import { createUIDesignId, type UIResponsiveBreakpoint } from "../model";

type ResponsiveBreakpointsPanelProps = {
  breakpoints: UIResponsiveBreakpoint[];
  open: boolean;
  onToggle: () => void;
  onChange: (items: UIResponsiveBreakpoint[]) => void;
  onCompare: () => void;
};

export function ResponsiveBreakpointsPanel(props: ResponsiveBreakpointsPanelProps) {
  const add = () => {
    if (props.breakpoints.length >= 32) return;
    const sorted = [...props.breakpoints].sort((a, b) => a.minWidth - b.minWidth);
    const last = sorted[sorted.length - 1];
    const next = sorted.map(item => ({ ...item }));
    let minWidth = 0;
    if (last?.maxWidth === undefined && last) {
      const index = next.findIndex(item => item.id === last.id);
      const maxWidth = Math.min(99999, last.minWidth + 599);
      if (maxWidth <= last.minWidth) return;
      next[index] = { ...last, maxWidth };
      minWidth = maxWidth + 1;
    } else minWidth = (last?.maxWidth ?? -1) + 1;
    props.onChange([...next, { id: createUIDesignId("breakpoint"), name: `Breakpoint ${props.breakpoints.length + 1}`, minWidth, maxWidth: undefined }]);
  };

  const change = (id: string, patch: Partial<UIResponsiveBreakpoint>) => {
    props.onChange(props.breakpoints.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  return <section class="ui-inspector-section ui-responsive-settings">
    <header><button type="button" class="ui-section-toggle" aria-expanded={props.open} onClick={props.onToggle}><span aria-hidden="true">{props.open ? "v" : ">"}</span> Responsive breakpoints</button><div><button type="button" title="Compare frame widths" onClick={props.onCompare}>Compare</button><button type="button" title="Add breakpoint" disabled={props.breakpoints.length >= 32} onClick={add}>Add</button></div></header>
    <Show when={props.open}>
      <For each={props.breakpoints}>{item => <div class="ui-breakpoint-editor"><input aria-label={`${item.name} breakpoint name`} value={item.name} onInput={event => change(item.id, { name: event.currentTarget.value })} /><label><span>Min</span><input type="number" min="0" max="100000" step="1" value={item.minWidth} onInput={event => { const v = Math.round(Number(event.currentTarget.value)); if (Number.isFinite(v) && v >= 0) change(item.id, { minWidth: v }); }} onBlur={event => { event.currentTarget.value = String(item.minWidth); }} /></label><label><span>Max</span><input type="number" min="0" max="100000" step="1" placeholder="none" value={item.maxWidth ?? ""} onInput={event => { if (event.currentTarget.value === "") { change(item.id, { maxWidth: undefined }); return; } const v = Math.round(Number(event.currentTarget.value)); if (Number.isFinite(v) && v >= 0) change(item.id, { maxWidth: v }); }} onBlur={event => { event.currentTarget.value = item.maxWidth != null ? String(item.maxWidth) : ""; }} /></label><button type="button" title={`Remove ${item.name}`} aria-label={`Remove ${item.name} breakpoint`} onClick={() => props.onChange(props.breakpoints.filter(candidate => candidate.id !== item.id))}>x</button></div>}</For>
    </Show>
  </section>;
}
