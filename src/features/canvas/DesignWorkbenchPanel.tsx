import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import type { Element, GroupElement, PrototypeAction, PrototypeComponentState, PrototypeVariable, DecisionCardMetadata } from "../../model";
import { LIBRARY_COMPONENTS, type LibraryComponentKind } from "../components/library-components";
import { previewTidySelection, type TidyPreview } from "./tidy-selection";
import "./design-workbench-panel.css";

type Tab = "tidy" | "replace" | "prototype" | "notes" | "decisions";
type Props = {
  elements: Element[];
  selectedIndices: number[];
  selected?: Element;
  pages: { id: string; name: string }[];
  activePageId: string;
  variables: PrototypeVariable[];
  masters: { id: string; name: string; variants?: Record<string, Element[]>; states?: Partial<Record<PrototypeComponentState, string>> }[];
  boardLocked: boolean;
  onClose: () => void;
  onTidy: (preview: TidyPreview) => void;
  onReplace: (kind: LibraryComponentKind) => void;
  onAction: (action?: PrototypeAction) => void;
  onOverlay: (enabled: boolean) => void;
  onFixed: (enabled: boolean) => void;
  onScroll: (direction?: "vertical" | "horizontal" | "both") => void;
  onAddVariable: (variable: PrototypeVariable) => void;
  onSetNoteTags: (tags: string[]) => void;
  onClusterNotes: (by: "color" | "tag") => void;
  onConvertNotesToTask: () => void;
  onCreateBoard: (title: string) => void;
  onPlaceInQuadrant: (quadrant: DecisionCardMetadata["quadrant"]) => void;
  onMapComponentState: (state: PrototypeComponentState, variant?: string) => void;
};

function titleOf(element?: Element): string {
  if (!element) return "";
  if (element.type === "group") return element.libraryComponent?.label ?? element.note?.title ?? element.container?.name ?? "Group";
  if (element.type === "schemaTable") return element.name;
  if (element.type === "text") return element.text;
  return "label" in element ? element.label?.text ?? element.type : element.type;
}

function TinyPreview(props: { preview: TidyPreview }) {
  const moves = () => props.preview.moves;
  const bounds = () => {
    const all = moves(); if (!all.length) return { x: 0, y: 0, w: 100, h: 60 };
    const points = props.preview.connectors.flatMap(item => [...item.before, ...item.after]);
    const x = Math.min(...all.flatMap(item => [item.from.x, item.to.x]), ...points.map(point => point.x)); const y = Math.min(...all.flatMap(item => [item.from.y, item.to.y]), ...points.map(point => point.y));
    const right = Math.max(...all.flatMap(item => [item.from.x + item.width, item.to.x + item.width]), ...points.map(point => point.x)); const bottom = Math.max(...all.flatMap(item => [item.from.y + item.height, item.to.y + item.height]), ...points.map(point => point.y));
    return { x: x - 8, y: y - 8, w: Math.max(16, right - x + 16), h: Math.max(16, bottom - y + 16) };
  };
  const view = () => { const box = bounds(); return `${box.x} ${box.y} ${box.w} ${box.h}`; };
  const scale = () => { const box = bounds(); return Math.max(.7, Math.min(12, Math.max(box.w, box.h) / 44)); };
  return <div class="design-tidy-preview" aria-label="Selection layout preview">
    <svg viewBox={view()} role="img" aria-label="Original selected object positions are grey; proposed tidy positions are blue">
      <For each={props.preview.connectors}>{connector => <><polyline points={connector.before.map(point => `${point.x},${point.y}`).join(" ")} class="tidy-before-route" /><polyline points={connector.after.map(point => `${point.x},${point.y}`).join(" ")} class="tidy-after-route" /></>}</For>
      <For each={moves()}>{item => <><rect x={item.from.x} y={item.from.y} width={item.width} height={item.height} rx={3 * scale()} class="tidy-before" /><rect x={item.to.x} y={item.to.y} width={item.width} height={item.height} rx={3 * scale()} class="tidy-after" /><text x={item.to.x + item.width / 2} y={item.to.y + item.height / 2} text-anchor="middle" dominant-baseline="middle">{item.label.slice(0, 16)}</text></>}</For>
    </svg>
  </div>;
}

export function DesignWorkbenchPanel(props: Props) {
  const [tab, setTab] = createSignal<Tab>("tidy");
  const [tidyPreview, setTidyPreview] = createSignal<TidyPreview>();
  const [replaceSearch, setReplaceSearch] = createSignal("");
  const [replaceKind, setReplaceKind] = createSignal<LibraryComponentKind>("software-service" as LibraryComponentKind);
  const [trigger, setTrigger] = createSignal<PrototypeAction["trigger"]>("click");
  const [actionKind, setActionKind] = createSignal<PrototypeAction["kind"]>("navigate");
  const [targetId, setTargetId] = createSignal("");
  const [variableId, setVariableId] = createSignal("");
  const [actionValue, setActionValue] = createSignal("");
  const [conditionVariable, setConditionVariable] = createSignal("");
  const [conditionOperator, setConditionOperator] = createSignal<NonNullable<PrototypeAction["condition"]>["operator"]>("equals");
  const [conditionValue, setConditionValue] = createSignal("");
  const [newVariableName, setNewVariableName] = createSignal("");
  const [newVariableType, setNewVariableType] = createSignal<PrototypeVariable["type"]>("string");
  const [newVariableValue, setNewVariableValue] = createSignal("");
  const [noteTags, setNoteTags] = createSignal("");
  const [boardTitle, setBoardTitle] = createSignal("Value vs effort");
  const selectedGroup = () => props.selected?.type === "group" ? props.selected : undefined;
  const selectedNotes = () => props.selectedIndices.map(index => props.elements[index]).filter((item): item is GroupElement => item?.type === "group" && !!item.note);
  const replaceOptions = createMemo(() => LIBRARY_COMPONENTS.filter(item => `${item.label} ${item.kind} ${item.section}`.toLowerCase().includes(replaceSearch().trim().toLowerCase())).slice(0, 100));
  const master = () => { const id = selectedGroup()?.masterId; return id ? props.masters.find(item => item.id === id) : undefined; };
  const targetOptions = () => props.elements.flatMap((item, index) => item.id && item.id !== props.selected?.id && !item.hidden ? [{ id: item.id, label: `${titleOf(item).slice(0, 54) || item.type} · ${index + 1}` }] : []);
  createEffect(() => {
    const selected = props.selected; const action = selected?.prototypeAction;
    setTrigger(action?.trigger ?? "click"); setActionKind(action?.kind ?? "navigate"); setTargetId(action?.targetId ?? ""); setVariableId(action?.variableId ?? ""); setActionValue(action?.value === undefined ? "" : String(action.value));
    setConditionVariable(action?.condition?.variableId ?? ""); setConditionOperator(action?.condition?.operator ?? "equals"); setConditionValue(action?.condition?.value === undefined ? "" : String(action.condition.value));
    setNoteTags(selected?.type === "group" && selected.note ? (selected.note.tags ?? []).join(", ") : "");
  });
  const saveAction = () => {
    const action: PrototypeAction = { trigger: trigger(), kind: actionKind() };
    if (actionKind() === "navigate" || actionKind() === "overlay") { if (!targetId()) return; action.targetId = targetId(); }
    if (actionKind() === "set-variable") { if (!variableId()) return; action.variableId = variableId(); action.value = actionValue(); }
    if (actionKind() === "set-state") { action.variableId = variableId() || "state"; action.value = actionValue() || "selected"; }
    if (conditionVariable()) action.condition = { variableId: conditionVariable(), operator: conditionOperator(), ...(["truthy", "falsy"].includes(conditionOperator()) ? {} : { value: conditionValue() }) };
    props.onAction(action);
  };
  const addVariable = () => {
    const name = newVariableName().trim(); if (!name || props.variables.length >= 100) return;
    const value = newVariableType() === "number" ? Number(newVariableValue()) || 0 : newVariableType() === "boolean" ? newVariableValue() === "true" : newVariableValue();
    props.onAddVariable({ id: crypto.randomUUID(), name: name.slice(0, 80), type: newVariableType(), value }); setNewVariableName(""); setNewVariableValue("");
  };
  const runTidyPreview = () => setTidyPreview(previewTidySelection(props.elements, props.selectedIndices));
  const applyTidy = () => { const preview = tidyPreview(); if (preview?.moves.length) props.onTidy(preview); setTidyPreview(undefined); };
  return <section class="design-workbench-panel" aria-label="Design workbench" onPointerDown={event => event.stopPropagation()}>
    <header class="design-workbench-header"><div><strong>Design workbench</strong><small>{props.selectedIndices.length ? `${props.selectedIndices.length} selected` : "Canvas tools"}</small></div><button type="button" aria-label="Close design workbench" onClick={props.onClose}>×</button></header>
    <nav class="design-workbench-tabs" aria-label="Design workbench sections">{([["tidy", "Tidy"], ["replace", "Replace"], ["prototype", "Prototype"], ["notes", "Notes"], ["decisions", "Decisions"]] as [Tab, string][]).map(([value, label]) => <button type="button" classList={{ active: tab() === value }} aria-pressed={tab() === value} onClick={() => { setTab(value); setTidyPreview(undefined); }}>{label}</button>)}</nav>
    <div class="design-workbench-content">
      <Show when={tab() === "tidy"}><section class="design-workbench-section"><h3>Tidy this selection</h3><p>Reflow selected objects into connected columns and compact rows. Unselected objects stay in place. Connector bindings are recalculated when applied.</p><button type="button" class="design-workbench-primary" disabled={props.boardLocked || props.selectedIndices.length < 2} onClick={runTidyPreview}>Preview tidy</button>
        <Show when={tidyPreview()}>{preview => <><Show when={preview().moves.length} fallback={<p class="design-workbench-hint">The selected objects are already tidy.</p>}><TinyPreview preview={preview()} /><small>{preview().moves.length} object{preview().moves.length === 1 ? "" : "s"} will move. Undo remains available.</small><button type="button" class="design-workbench-primary" disabled={props.boardLocked} onClick={applyTidy}>Apply tidy</button></Show></>}</Show>
      </section></Show>

      <Show when={tab() === "replace"}><section class="design-workbench-section"><h3>Replace component</h3><p>Keep the selected object’s ID, position, page links, task links, and attached connector bindings while applying a stencil.</p><Show when={props.selected} fallback={<p class="design-workbench-hint">Select one node, note, or component first.</p>}><label>Find component<input type="search" value={replaceSearch()} placeholder="Search components" onInput={event => setReplaceSearch(event.currentTarget.value)} /></label><label>Component<select value={replaceKind()} disabled={props.boardLocked} onChange={event => setReplaceKind(event.currentTarget.value as LibraryComponentKind)}><For each={replaceOptions()}>{item => <option value={item.kind}>{item.section} · {item.label}</option>}</For></select></label><button type="button" class="design-workbench-primary" disabled={props.boardLocked || !props.selected || props.selected.type === "line" || props.selected.type === "arrow" || props.selected.type === "freehand"} onClick={() => props.onReplace(replaceKind())}>Replace selected</button></Show></section></Show>

      <Show when={tab() === "prototype"}><section class="design-workbench-section"><h3>Prototype interactions</h3><Show when={props.selected} fallback={<p class="design-workbench-hint">Select a control or component to edit its behavior.</p>}>
        <label>Trigger<select value={trigger()} disabled={props.boardLocked} onChange={event => setTrigger(event.currentTarget.value as PrototypeAction["trigger"])}><option value="click">Click</option><option value="hover">Hover</option><option value="press">Press</option></select></label>
        <label>Action<select value={actionKind()} disabled={props.boardLocked} onChange={event => setActionKind(event.currentTarget.value as PrototypeAction["kind"])}><option value="navigate">Navigate to page</option><option value="overlay">Open / close overlay</option><option value="set-variable">Set variable</option><option value="set-state">Set component state</option></select></label>
        <Show when={actionKind() === "navigate"}><label>Page<select value={targetId()} disabled={props.boardLocked} onChange={event => setTargetId(event.currentTarget.value)}><option value="">Choose a page</option><For each={props.pages.filter(page => page.id !== props.activePageId)}>{page => <option value={page.id}>{page.name}</option>}</For></select></label></Show>
        <Show when={actionKind() === "overlay"}><label>Overlay<select value={targetId()} disabled={props.boardLocked} onChange={event => setTargetId(event.currentTarget.value)}><option value="">Choose an object</option><For each={targetOptions()}>{item => <option value={item.id}>{item.label}</option>}</For></select></label></Show>
        <Show when={actionKind() === "set-variable"}><label>Variable<select value={variableId()} disabled={props.boardLocked} onChange={event => setVariableId(event.currentTarget.value)}><option value="">Choose variable</option><For each={props.variables}>{variable => <option value={variable.id}>{variable.name}</option>}</For></select></label><label>Value<input value={actionValue()} onInput={event => setActionValue(event.currentTarget.value)} /></label></Show>
        <Show when={actionKind() === "set-state"}><label>State<select value={actionValue() || "selected"} disabled={props.boardLocked} onChange={event => setActionValue(event.currentTarget.value)}><option value="hover">Hover</option><option value="pressed">Pressed</option><option value="selected">Selected</option><option value="disabled">Disabled</option></select></label></Show>
        <fieldset class="design-workbench-condition"><legend>Only when (optional)</legend><label>Variable<select value={conditionVariable()} disabled={props.boardLocked} onChange={event => setConditionVariable(event.currentTarget.value)}><option value="">Always</option><For each={props.variables}>{variable => <option value={variable.id}>{variable.name}</option>}</For></select></label><Show when={conditionVariable()}><label>Rule<select value={conditionOperator()} onChange={event => setConditionOperator(event.currentTarget.value as NonNullable<PrototypeAction["condition"]>["operator"])}><option value="equals">equals</option><option value="not-equals">does not equal</option><option value="greater-than">is greater than</option><option value="less-than">is less than</option><option value="truthy">is true</option><option value="falsy">is false</option></select></label><Show when={!['truthy', 'falsy'].includes(conditionOperator())}><label>Value<input value={conditionValue()} onInput={event => setConditionValue(event.currentTarget.value)} /></label></Show></Show></fieldset>
        <div class="design-workbench-actions"><button type="button" disabled={props.boardLocked} onClick={saveAction}>Save interaction</button><button type="button" disabled={props.boardLocked} onClick={() => props.onAction(undefined)}>Clear</button></div>
        <Show when={selectedGroup()?.masterId && master()}><fieldset class="design-workbench-condition"><legend>Reusable component states</legend><For each={(["hover", "pressed", "selected", "disabled"] as PrototypeComponentState[])}>{state => <label>{state}<select value={master()?.states?.[state] ?? ""} disabled={props.boardLocked} onChange={event => props.onMapComponentState(state, event.currentTarget.value || undefined)}><option value="">Default appearance</option><For each={Object.keys(master()?.variants ?? {})}>{variant => <option value={variant}>{variant}</option>}</For></select></label>}</For></fieldset></Show>
        <Show when={selectedGroup()?.container}><label>Scrollable frame<select value={selectedGroup()?.container?.scrollDirection ?? ""} disabled={props.boardLocked} onChange={event => props.onScroll(event.currentTarget.value ? event.currentTarget.value as "vertical" | "horizontal" | "both" : undefined)}><option value="">Not scrollable</option><option value="vertical">Vertical</option><option value="horizontal">Horizontal</option><option value="both">Both directions</option></select></label></Show>
        <label class="design-workbench-check"><input type="checkbox" checked={props.selected?.prototypeOverlay === true} disabled={props.boardLocked} onChange={event => props.onOverlay(event.currentTarget.checked)} /> Selected object is an overlay</label>
        <label class="design-workbench-check"><input type="checkbox" checked={props.selected?.prototypeFixed === true} disabled={props.boardLocked} onChange={event => props.onFixed(event.currentTarget.checked)} /> Keep selected object fixed while scrolling</label>
      </Show>
      <fieldset class="design-workbench-condition"><legend>Prototype variables</legend><For each={props.variables}>{variable => <div class="design-variable-row"><span><strong>{variable.name}</strong><small>{variable.type} · {String(variable.value)}</small></span></div>}</For><div class="design-variable-new"><input aria-label="Variable name" placeholder="Name" value={newVariableName()} onInput={event => setNewVariableName(event.currentTarget.value)} /><select aria-label="Variable type" value={newVariableType()} onChange={event => setNewVariableType(event.currentTarget.value as PrototypeVariable["type"])}><option value="string">Text</option><option value="number">Number</option><option value="boolean">Boolean</option></select><input aria-label="Initial value" placeholder="Initial value" value={newVariableValue()} onInput={event => setNewVariableValue(event.currentTarget.value)} /><button type="button" disabled={props.boardLocked || !newVariableName().trim()} onClick={addVariable}>Add</button></div></fieldset>
      </section></Show>

      <Show when={tab() === "notes"}><section class="design-workbench-section"><h3>Sticky-note groups</h3><p>Sort selected notes into visual clusters by surface color or their first tag. Add tags to help keep clusters consistent.</p><label>Tags for selected notes<input value={noteTags()} placeholder={selectedNotes().flatMap(note => note.note?.tags ?? []).join(", ")} disabled={props.boardLocked || !selectedNotes().length} onInput={event => setNoteTags(event.currentTarget.value)} /></label><button type="button" disabled={props.boardLocked || !selectedNotes().length} onClick={() => props.onSetNoteTags([...new Set(noteTags().split(",").map(tag => tag.trim()).filter(Boolean))].slice(0, 16))}>Save tags on selection</button><div class="design-workbench-actions"><button type="button" disabled={props.boardLocked || selectedNotes().length < 2} onClick={() => props.onClusterNotes("color")}>Cluster by color</button><button type="button" disabled={props.boardLocked || selectedNotes().length < 2} onClick={() => props.onClusterNotes("tag")}>Cluster by tag</button></div><button type="button" disabled={props.boardLocked || !selectedNotes().length} onClick={props.onConvertNotesToTask}>Convert selection to planning task</button><small>Use Replace to turn a selected note into a stencil or diagram node.</small></section></Show>

      <Show when={tab() === "decisions"}><section class="design-workbench-section"><h3>Decision board</h3><p>Create a canvas matrix, then move notes or cards into its quadrants. The grid stays editable and ranks selected cards when placed.</p><label>Board title<input value={boardTitle()} onInput={event => setBoardTitle(event.currentTarget.value)} /></label><button type="button" class="design-workbench-primary" disabled={props.boardLocked} onClick={() => props.onCreateBoard(boardTitle().trim() || "Decision board")}>Create value / effort grid</button><div class="design-quadrant-actions"><button type="button" disabled={props.boardLocked || !props.selectedIndices.length} onClick={() => props.onPlaceInQuadrant("high-low")}>High value · low effort</button><button type="button" disabled={props.boardLocked || !props.selectedIndices.length} onClick={() => props.onPlaceInQuadrant("high-high")}>High value · high effort</button><button type="button" disabled={props.boardLocked || !props.selectedIndices.length} onClick={() => props.onPlaceInQuadrant("low-low")}>Low value · low effort</button><button type="button" disabled={props.boardLocked || !props.selectedIndices.length} onClick={() => props.onPlaceInQuadrant("low-high")}>Low value · high effort</button></div></section></Show>
    </div>
  </section>;
}
