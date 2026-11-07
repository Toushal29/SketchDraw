import { For, Show } from "solid-js";
import type { GroupElement, UiComponentProperties } from "../model";
import { ChartEditor } from "./ChartEditor";
import { isUiComponentKind, uiProperties } from "../features/components/ui-components";
import {
  libraryComponentFields,
  libraryComponentFontSize,
  libraryLifelineLength,
  resizeLibraryFont,
  setLibraryComponentField,
  setLibraryLifelineLength,
  setLibraryPortCount,
  updateUiComponentProperties,
} from "../features/components/library-component-editor";
import { applyWireframeViewportPreset, wireframeViewportPresets } from "../features/components/wireframe-presets";

type Props = {
  group: () => GroupElement;
  isDraft: boolean;
  boardLocked: () => boolean;
  onChangeGroup: (operation: (current: GroupElement) => GroupElement, componentId?: string, transient?: boolean) => void;
  onCommitTextEdit: (componentId?: string) => void;
  onRememberFontSize: (size: number) => void;
  onCancelDraft: () => void;
  onCommitDraft: () => void;
  disclosureOpen: (key: string, defaultOpen?: boolean) => boolean;
  onDisclosureToggle: (key: string, defaultOpen?: boolean) => (event: Event) => void;
};

const TITLE_PLACEMENTS: { value: NonNullable<UiComponentProperties["titlePlacement"]>; label: string }[] = [
  { value: "above", label: "Above" }, { value: "below", label: "Below" },
  { value: "leading", label: "Leading" }, { value: "trailing", label: "Trailing" },
];
const ARRANGEMENTS: { value: NonNullable<UiComponentProperties["arrangement"]>; label: string }[] = [
  { value: "stack", label: "Stack" }, { value: "inline", label: "Inline" }, { value: "grid", label: "Grid" },
];
const TONES: NonNullable<UiComponentProperties["tone"]>[] = ["brand", "neutral", "positive", "warning", "critical"];

export function LibraryComponentEditor(props: Props) {
  const group = props.group;
  const kind = () => group().libraryComponent?.kind ?? "custom";
  const isUi = () => isUiComponentKind(kind());
  const properties = (current: GroupElement = group()) => uiProperties(current);
  const changeGroup = props.onChangeGroup;
  const componentId = () => group().id ?? group().componentId;
  const locked = () => !props.isDraft && (props.boardLocked() || !!group().locked);
  const hasEditableText = () => isUi() || kind().startsWith("viz-") || libraryComponentFields(group()).some(field => field.value.trim().length > 0);

  const editText = (event: Event, operation: (current: GroupElement) => GroupElement) => {
    if (props.isDraft) { changeGroup(operation); return; }
    const target = event.currentTarget as HTMLInputElement | HTMLTextAreaElement | null;
    const id = target?.dataset.componentId ?? componentId();
    if (target && id) target.dataset.componentId = id;
    changeGroup(operation, id, true);
  };
  const finishTextEdit = (event: FocusEvent) => {
    if (!props.isDraft) props.onCommitTextEdit((event.currentTarget as HTMLElement | null)?.dataset.componentId);
  };
  const updateUi = (patch: Partial<UiComponentProperties>) => changeGroup(current => updateUiComponentProperties(current, patch));
  const addItem = () => {
    const items = properties().items ?? [];
    if (items.length >= 12) return;
    updateUi({ items: [...items, { id: crypto.randomUUID(), label: `Item ${items.length + 1}` }] });
  };
  const removeItem = (index: number) => updateUi({ items: (properties().items ?? []).filter((_, itemIndex) => itemIndex !== index) });
  const selectedItem = (current: GroupElement, id: string) => properties(current).selectedItemId === id;
  const changeComponentFontSize = (requestedSize: number) => {
    if (!Number.isFinite(requestedSize) || requestedSize < 8 || requestedSize > 160) return;
    props.onRememberFontSize(requestedSize);
    changeGroup(current => resizeLibraryFont(current, requestedSize));
  };
  const viewportPresets = () => wireframeViewportPresets(kind());
  const applyViewportPreset = (preset: ReturnType<typeof wireframeViewportPresets>[number]) => changeGroup(current => applyWireframeViewportPreset(current, preset));
  const viewportValue = () => group().libraryComponent?.componentFields?.find(field => field.key === "viewport")?.value.trim();
  const changePortCount = (requested: number) => changeGroup(current => setLibraryPortCount(current, Math.max(1, Math.min(32, Math.round(requested)))));
  const changeLaneCount = (requested: number) => changeGroup(current => ({ ...current, libraryComponent: { ...current.libraryComponent!, laneCount: Math.max(2, Math.min(8, Math.round(requested))) } }));
  const updateDiagramTitle = (current: GroupElement, value: string) => ({ ...current, libraryComponent: { ...current.libraryComponent!, label: value.slice(0, 120) } });
  const changeTaskDuration = (requested: number) => changeGroup(current => ({ ...current, libraryComponent: { ...current.libraryComponent!, durationMinutes: Number.isFinite(requested) ? Math.max(0, Math.min(100000, requested)) : 0 } }));
  const commonTitle = () => properties().title ?? "";
  const items = () => properties().items ?? [];

  return <div class="component-editor-content library-component-properties">
    <Show when={libraryComponentFields(group()).length > 0}>
      <div class="component-field-list"><For each={libraryComponentFields(group()).map(field => field.key)}>{key => {
        const field = () => libraryComponentFields(group()).find(entry => entry.key === key)!;
        return <label class="property-label"><span>{field().label}</span><textarea data-component-field-key={key} rows={Math.min(4, Math.max(1, field().value.split(/\r?\n/).length))} maxlength="2000" placeholder={field().hint} value={field().value} disabled={locked()} onInput={event => editText(event, current => setLibraryComponentField(current, key, event.currentTarget.value))} onBlur={finishTextEdit} /></label>;
      }}</For></div>
    </Show>

    <Show when={viewportPresets().length > 0}><section class="component-property-choice"><span>Viewport size preset</span><div class="component-editor-choice-group component-editor-choice-wrap" role="group" aria-label="Viewport size preset"><For each={viewportPresets()}>{preset => {
      const selected = () => viewportValue() === `${preset.label} · ${preset.w} × ${preset.h}`;
      return <button type="button" class={selected() ? "active" : ""} aria-pressed={selected()} disabled={locked()} onClick={() => applyViewportPreset(preset)}>{preset.label} · {preset.w} × {preset.h}</button>;
    }}</For></div></section></Show>
    <Show when={kind() === "uml-lifeline"}><label class="property-label">Lifeline length<input aria-label="Lifeline length" type="number" min="24" max="4000" step="1" value={libraryLifelineLength(group())} disabled={locked()} onChange={event => changeGroup(current => setLibraryLifelineLength(current, Number(event.currentTarget.value)))} /></label></Show>
    <Show when={kind() === "bpmn-task"}><label class="property-label">Task duration (minutes)<input aria-label="BPMN task duration in minutes" type="number" min="0" max="100000" step="1" value={group().libraryComponent?.durationMinutes ?? 0} disabled={locked()} onChange={event => changeTaskDuration(Number(event.currentTarget.value))} /></label></Show>
    <Show when={kind() === "network-switch" || kind() === "network-hub"}><section class="component-port-editor"><strong>Visible ports</strong><label>Count<input aria-label="Number of visible hardware ports" type="number" min="1" max="32" step="1" value={group().libraryComponent?.portCount ?? (kind() === "network-hub" ? 8 : 6)} disabled={locked()} onChange={event => changePortCount(Number(event.currentTarget.value))} /></label></section></Show>
    <Show when={kind() === "diagram-frame" || kind() === "diagram-swimlane"}>
      <label class="property-label">Title<input aria-label="Frame or swimlane title" maxlength="120" value={group().libraryComponent?.label ?? ""} disabled={locked()} onInput={event => editText(event, current => updateDiagramTitle(current, event.currentTarget.value))} onBlur={finishTextEdit} /></label>
      <Show when={kind() === "diagram-swimlane"}><label class="property-label">Lane count<input aria-label="Number of swimlanes" type="number" min="2" max="8" step="1" value={group().libraryComponent?.laneCount ?? 3} disabled={locked()} onChange={event => changeLaneCount(Number(event.currentTarget.value))} /></label></Show>
    </Show>

    <Show when={isUi()}>
      <label class="property-label">{kind() === "ui.avatar" ? "Initials or label" : "Title"}<input aria-label="Component title" maxlength="240" value={commonTitle()} disabled={locked()} onInput={event => editText(event, current => updateUiComponentProperties(current, { title: event.currentTarget.value }))} onBlur={finishTextEdit} /></label>
      <Show when={["ui.card", "ui.alert", "ui.dialog", "ui.toast"].includes(kind())}><label class="property-label">Message<textarea aria-label="Component message" maxlength="2000" rows="3" value={properties().body ?? ""} disabled={locked()} onInput={event => editText(event, current => updateUiComponentProperties(current, { body: event.currentTarget.value }))} onBlur={finishTextEdit} /></label></Show>
      <Show when={["ui.text-field", "ui.select", "ui.textarea", "ui.search", "ui.date-field", "ui.password-field", "ui.email-field", "ui.file-upload", "ui.image"].includes(kind())}><label class="property-label">Placeholder<input aria-label="Component placeholder" maxlength="240" value={properties().placeholder ?? ""} disabled={locked()} onInput={event => editText(event, current => updateUiComponentProperties(current, { placeholder: event.currentTarget.value }))} onBlur={finishTextEdit} /></label></Show>
      <Show when={kind() === "ui.button" || kind() === "ui.dialog"}><label class="property-label">Primary action<input aria-label="Primary action" maxlength="120" value={properties().action ?? ""} disabled={locked()} onInput={event => editText(event, current => updateUiComponentProperties(current, { action: event.currentTarget.value }))} onBlur={finishTextEdit} /></label></Show>
      <Show when={kind() === "ui.dialog"}><label class="property-label">Secondary action<input aria-label="Secondary action" maxlength="120" value={properties().secondaryAction ?? ""} disabled={locked()} onInput={event => editText(event, current => updateUiComponentProperties(current, { secondaryAction: event.currentTarget.value }))} onBlur={finishTextEdit} /></label></Show>
      <Show when={["ui.button", "ui.alert", "ui.badge", "ui.toast"].includes(kind())}><label class="property-label">Tone<select aria-label="Component tone" value={properties().tone ?? "neutral"} disabled={locked()} onChange={event => updateUi({ tone: event.currentTarget.value as UiComponentProperties["tone"] })}>{TONES.map(tone => <option value={tone}>{tone[0].toUpperCase() + tone.slice(1)}</option>)}</select></label></Show>
      <Show when={kind() === "ui.switch"}><label class="component-state-control"><input type="checkbox" checked={properties().checked ?? false} disabled={locked()} onChange={event => updateUi({ checked: event.currentTarget.checked })} /><span class="component-switch" aria-hidden="true" /><strong>{properties().checked ? "On" : "Off"}</strong></label></Show>
      <Show when={kind() === "ui.progress" || kind() === "ui.slider"}><label class="property-label">Value<input aria-label="Component value" type="range" min="0" max="100" value={properties().progress ?? 0} disabled={locked()} onInput={event => updateUi({ progress: Number(event.currentTarget.value) })} /><output>{properties().progress ?? 0}%</output></label></Show>

      <Show when={items().length > 0 || ["ui.checkbox-group", "ui.radio-group", "ui.select", "ui.tabs", "ui.side-navigation", "ui.breadcrumbs", "ui.pagination", "ui.list", "ui.table", "ui.accordion", "ui.menu", "ui.footer"].includes(kind())}>
        <section class="component-options-editor">
          <header><strong>{kind() === "ui.checkbox-group" ? "Choices" : kind() === "ui.table" ? "Table cells" : "Items"}</strong><span>{items().length}/12</span></header>
          <div class="component-option-list"><For each={items()}>{(item, index) => <div class="component-option-row">
            <span>{index() + 1}</span>
            <Show when={kind() === "ui.checkbox-group"}><input class="component-option-check" type="checkbox" aria-label={`Select ${item.label}`} checked={(properties().selectedItemIds ?? []).includes(item.id)} disabled={locked()} onChange={event => updateUi({ selectedItemIds: event.currentTarget.checked ? [...(properties().selectedItemIds ?? []), item.id] : (properties().selectedItemIds ?? []).filter(id => id !== item.id) })} /></Show>
            <Show when={kind() === "ui.radio-group" || kind() === "ui.select"}><input class="component-option-radio" type="radio" name={`ui-item-${group().id}`} aria-label={`Choose ${item.label}`} checked={selectedItem(group(), item.id)} disabled={locked()} onChange={() => updateUi({ selectedItemId: item.id })} /></Show>
            <input aria-label={`Item ${index() + 1} label`} maxlength="120" value={item.label} disabled={locked()} onInput={event => {
              const target = event.currentTarget;
              editText(event, current => { const next = [...(properties(current).items ?? [])]; if (next[index()]) next[index()] = { ...next[index()], label: target.value.slice(0, 120) }; return updateUiComponentProperties(current, { items: next }); });
            }} onBlur={finishTextEdit} />
            <button type="button" class="quiet-button" aria-label={`Remove ${item.label}`} disabled={locked()} onClick={() => removeItem(index())}>×</button>
          </div>}</For></div>
          <div class="component-option-actions"><button type="button" disabled={locked() || items().length >= 12} onClick={addItem}>Add item</button></div>
        </section>
      </Show>

      <Show when={kind() === "ui.checkbox-group" || kind() === "ui.radio-group"}>
        <div class="component-property-choice"><span>Title position</span><div class="component-editor-choice-group component-editor-choice-wrap" role="group" aria-label="Choice title position"><For each={TITLE_PLACEMENTS}>{placement => <button type="button" class={properties().titlePlacement === placement.value ? "active" : ""} aria-pressed={properties().titlePlacement === placement.value} disabled={locked()} onClick={() => updateUi({ titlePlacement: placement.value })}>{placement.label}</button>}</For></div></div>
        <div class="component-property-choice"><span>Arrangement</span><div class="component-editor-choice-group" role="group" aria-label="Choice arrangement"><For each={ARRANGEMENTS}>{arrangement => <button type="button" class={properties().arrangement === arrangement.value ? "active" : ""} aria-pressed={properties().arrangement === arrangement.value} disabled={locked()} onClick={() => updateUi({ arrangement: arrangement.value })}>{arrangement.label}</button>}</For></div></div>
        <Show when={properties().arrangement === "grid"}><label class="property-label">Columns<input aria-label="Choice grid columns" type="number" min="1" max="6" value={properties().columns ?? 2} disabled={locked()} onChange={event => updateUi({ columns: Number(event.currentTarget.value) })} /></label></Show>
        <label class="property-label">Item spacing<input aria-label="Choice item spacing" type="number" min="0" max="40" value={properties().gap ?? 8} disabled={locked()} onChange={event => updateUi({ gap: Number(event.currentTarget.value) })} /></label>
      </Show>
    </Show>

    <Show when={kind().startsWith("viz-")}><ChartEditor group={group} isDraft={props.isDraft} locked={locked} onChangeGroup={changeGroup} onCommitTextEdit={props.onCommitTextEdit} /></Show>
    <Show when={hasEditableText()}><label class="property-label">Font size<input aria-label="Component font size" type="number" min="8" max="160" value={libraryComponentFontSize(group())} disabled={locked()} onChange={event => changeComponentFontSize(Number(event.currentTarget.value))} /></label></Show>
    <Show when={props.isDraft}><div class="component-draft-actions"><button class="quiet-button" type="button" onClick={props.onCancelDraft}>Cancel</button><button class="save-button" type="button" disabled={props.boardLocked()} onClick={props.onCommitDraft}>Add to canvas</button></div></Show>
  </div>;
}
