import { For, Show } from "solid-js";
import type { GroupElement, GuiComponentProperties } from "../model";
import { ChartEditor } from "./ChartEditor";
import { defaultGuiComponentProperties } from "../features/components/gui-components";
import {
  defaultLibraryFormOptions,
  defaultLibraryFormTitle,
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
  onChangeGroup: (operation: (current: GroupElement) => GroupElement, componentId?: string, transient?: boolean) => void;
  onCommitTextEdit: (componentId?: string) => void;
  onRememberFontSize: (size: number) => void;
  onCancelDraft: () => void;
  onCommitDraft: () => void;
  disclosureOpen: (key: string, defaultOpen?: boolean) => boolean;
  onDisclosureToggle: (key: string, defaultOpen?: boolean) => (event: Event) => void;
};

export function LibraryComponentEditor(props: Props) {
  const group = props.group;
  const kind = () => group().libraryComponent?.kind ?? "custom";
  const hasEditableText = () => kind().startsWith("viz-") || kind().startsWith("form-") || kind().startsWith("gui-") || libraryComponentFields(group()).some(field => field.value.trim().length > 0);
  const optionsFor = (component: GroupElement) => {
    const stored = component.libraryComponent?.formOptions;
    return stored?.length ? stored : defaultLibraryFormOptions(component.libraryComponent?.kind as LibraryComponentKind) ?? [];
  };
  const options = () => optionsFor(group());
  const guiProperties = (component: GroupElement = group()) => ({ ...defaultGuiComponentProperties(component.libraryComponent?.kind ?? ""), ...(component.libraryComponent?.guiProperties ?? {}) });
  const titlePositions = [{ value: "top", label: "Top" }, { value: "bottom", label: "Bottom" }, { value: "left", label: "Left" }, { value: "right", label: "Right" }] as const;
  const optionLayouts = [{ value: "vertical", label: "Vertical" }, { value: "horizontal", label: "Horizontal" }, { value: "grid", label: "Grid" }] as const;
  const changeGroup = props.onChangeGroup;
  const componentId = () => group().id ?? group().componentId;
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
  const changeComponentFontSize = (requestedSize: number) => {
    if (!Number.isFinite(requestedSize) || requestedSize < 8 || requestedSize > 160) return;
    props.onRememberFontSize(requestedSize);
    changeGroup(current => resizeLibraryFont(current, requestedSize));
  };
  const updateOption = (current: GroupElement, index: number, value: string) => {
    const next = [...optionsFor(current)];
    next[index] = value.slice(0, 120);
    return rebuildLibraryFormOptions(current, next);
  };
  const updateGuiProperties = (current: GroupElement, patch: Partial<GuiComponentProperties>) => {
    const updated = {
      ...current,
      libraryComponent: {
        ...current.libraryComponent!,
        guiProperties: { ...defaultGuiComponentProperties(current.libraryComponent?.kind ?? ""), ...(current.libraryComponent?.guiProperties ?? {}), ...patch },
      },
    };
    const bounds = updated.componentBounds;
    if (!bounds) return updated;
    const minimumHeight = libraryComponentMinimum(updated, "h");
    return bounds.h < minimumHeight ? resizeLibraryGroup(updated, { ...bounds, h: minimumHeight }) : updated;
  };
  const changeGuiProperties = (patch: Partial<GuiComponentProperties>) => changeGroup(current => updateGuiProperties(current, patch));
  const optionGap = (axis: "row" | "column") => {
    const properties = guiProperties();
    return axis === "row" ? properties.optionRowGap ?? properties.optionGap ?? 4 : properties.optionColumnGap ?? properties.optionGap ?? 4;
  };
  const adjustOptionGap = (axis: "row" | "column", delta: number) => {
    const key = axis === "row" ? "optionRowGap" : "optionColumnGap";
    changeGuiProperties({ [key]: Math.max(0, Math.min(40, optionGap(axis) + delta)) });
  };
  const renderOptionSpacing = (subject: string, axes: ("row" | "column")[] = ["row", "column"]) => <div class={`component-option-spacing ${axes.length === 1 ? "single" : ""}`}>{axes.map(axis => <div class="component-option-gap-control"><span>{subject} {axis} gap</span><button type="button" aria-label={`Decrease ${subject.toLowerCase()} ${axis} gap`} disabled={locked() || optionGap(axis) <= 0} onClick={() => adjustOptionGap(axis, -2)}>−</button><output>{optionGap(axis)}</output><button type="button" aria-label={`Increase ${subject.toLowerCase()} ${axis} gap`} disabled={locked() || optionGap(axis) >= 40} onClick={() => adjustOptionGap(axis, 2)}>+</button></div>)}</div>;
  const updateGuiItem = (current: GroupElement, index: number, value: string) => {
    const currentItems = guiProperties(current).items ?? [];
    const items = [...currentItems]; items[index] = value.slice(0, 120);
    return updateGuiProperties(current, { items });
  };
  const addGuiItem = () => changeGuiProperties({ items: [...(guiProperties().items ?? []), `Item ${(guiProperties().items?.length ?? 0) + 1}`].slice(0, 12) });
  const removeGuiItem = (index: number) => {
    const items = (guiProperties().items ?? []).filter((_, current) => current !== index);
    changeGuiProperties({ items: items.length ? items : ["Item 1"], activeItem: Math.min(guiProperties().activeItem ?? 0, Math.max(0, items.length - 1)) });
  };
  const changePortCount = (requested: number) => changeGroup(current => setLibraryPortCount(current, Math.max(1, Math.min(32, Math.round(requested)))));
  const changeLaneCount = (requested: number) => changeGroup(current => ({ ...current, libraryComponent: { ...current.libraryComponent!, laneCount: Math.max(2, Math.min(8, Math.round(requested))) } }));
  const updateDiagramTitle = (current: GroupElement, value: string) => ({ ...current, libraryComponent: { ...current.libraryComponent!, label: value.slice(0, 120) } });
  const changeTaskDuration = (requested: number) => changeGroup(current => {
    const durationMinutes = Number.isFinite(requested) ? Math.max(0, Math.min(100000, requested)) : 0;
    return { ...current, libraryComponent: { ...current.libraryComponent!, durationMinutes } };
  });
  const changeSelectedOption = (index: number) => changeGroup(current => current.libraryComponent?.kind === "form-radio"
    ? setLibraryRadioOption(current, index)
    : rebuildLibraryFormOptions(current, optionsFor(current), index));
  const addOption = () => changeGroup(current => rebuildLibraryFormOptions(current, [...optionsFor(current), `Option ${optionsFor(current).length + 1}`]));
  const removeOption = () => changeGroup(current => rebuildLibraryFormOptions(current, optionsFor(current).slice(0, -1)));
  const locked = () => !props.isDraft && (props.boardLocked() || !!group().locked);

  return <div class="component-editor-content library-component-properties">
    <Show when={libraryComponentFields(group()).length > 0}><div class="component-field-list"><For each={libraryComponentFields(group()).map(field => field.key)}>{key => { const field = () => libraryComponentFields(group()).find(entry => entry.key === key)!; return <label class="property-label"><span>{field().label}</span><textarea data-component-field-key={key} rows={Math.min(4, Math.max(1, field().value.split(/\r?\n/).length))} maxlength="2000" placeholder={field().hint} value={field().value} disabled={locked()} onInput={event => editText(event, current => setLibraryComponentField(current, key, event.currentTarget.value))} onBlur={finishTextEdit} /></label>; }}</For></div></Show>
    <Show when={kind() === "uml-lifeline"}><label class="property-label">Lifeline length<input aria-label="Lifeline length" type="number" min="24" max="4000" step="1" value={libraryLifelineLength(group())} disabled={locked()} onChange={event => changeGroup(current => setLibraryLifelineLength(current, Number(event.currentTarget.value)))} /></label></Show>
    <Show when={kind() === "bpmn-task"}><label class="property-label">Task duration (minutes)<input aria-label="BPMN task duration in minutes" type="number" min="0" max="100000" step="1" value={group().libraryComponent?.durationMinutes ?? 0} disabled={locked()} onChange={event => changeTaskDuration(Number(event.currentTarget.value))} /></label></Show>
    <Show when={kind() === "form-toggle"}>
      <label class="property-label component-form-title">Title<input aria-label="Toggle title" maxlength="80" value={group().libraryComponent?.formTitle ?? defaultLibraryFormTitle(kind() as LibraryComponentKind) ?? ""} disabled={locked()} onInput={event => editText(event, current => setLibraryFormTitle(current, event.currentTarget.value))} onBlur={finishTextEdit} /></label>
      <label class="component-state-control"><input type="checkbox" checked={group().libraryComponent?.formState ?? true} disabled={locked()} onChange={event => changeGroup(current => setLibraryFormState(current, event.currentTarget.checked))} /><span class="component-switch" aria-hidden="true" /><strong>{group().libraryComponent?.formState === false ? "Off" : "On"}</strong></label>
    </Show>
    <Show when={kind() === "form-input" || kind() === "form-select"}>
      <label class="property-label component-form-title">{kind() === "form-input" ? "Field label" : "Field title"}<input aria-label={kind() === "form-input" ? "Text field label" : "Select field title"} maxlength="80" value={group().libraryComponent?.formTitle ?? defaultLibraryFormTitle(kind() as LibraryComponentKind) ?? ""} disabled={locked()} onInput={event => editText(event, current => setLibraryFormTitle(current, event.currentTarget.value))} onBlur={finishTextEdit} /></label>
      <label class="property-label">Placeholder<input aria-label="Field placeholder" maxlength="160" value={guiProperties().placeholder ?? (kind() === "form-select" ? "Choose an option" : "Enter text")} disabled={locked()} onInput={event => editText(event, current => updateGuiProperties(current, { placeholder: event.currentTarget.value }))} onBlur={finishTextEdit} /></label>
      <div class="component-property-choice"><span>Title position</span><div class="component-editor-choice-group" role="group" aria-label="Field title position"><For each={titlePositions}>{position => <button type="button" class={guiProperties().titlePosition === position.value ? "active" : ""} aria-pressed={guiProperties().titlePosition === position.value} disabled={locked()} onClick={() => changeGuiProperties({ titlePosition: position.value })}>{position.label}</button>}</For></div></div>
    </Show>
    <Show when={kind() === "network-switch" || kind() === "network-hub"}>
      <section class="component-port-editor"><div><strong>Visible ports</strong><small>Sets how many the symbol shows</small></div><label>Count<input aria-label="Number of visible hardware ports" type="number" min="1" max="32" step="1" value={group().libraryComponent?.portCount ?? (kind() === "network-hub" ? 8 : 6)} disabled={locked()} onChange={event => changePortCount(Number(event.currentTarget.value))} /></label></section>
    </Show>
    <Show when={kind() === "diagram-frame" || kind() === "diagram-swimlane"}>
      <label class="property-label">Title<input aria-label="Frame or swimlane title" maxlength="120" value={group().libraryComponent?.label ?? ""} disabled={locked()} onInput={event => editText(event, current => updateDiagramTitle(current, event.currentTarget.value))} onBlur={finishTextEdit} /></label>
      <Show when={kind() === "diagram-swimlane"}><label class="property-label">Lane count<input aria-label="Number of swimlanes" type="number" min="2" max="8" step="1" value={group().libraryComponent?.laneCount ?? 3} disabled={locked()} onChange={event => changeLaneCount(Number(event.currentTarget.value))} /></label></Show>
    </Show>
    <Show when={kind() === "gui-card"}>
      <label class="property-label">Title<input aria-label="Card title" maxlength="120" value={guiProperties().title ?? "Card title"} disabled={locked()} onInput={event => editText(event, current => updateGuiProperties(current, { title: event.currentTarget.value }))} onBlur={finishTextEdit} /></label>
      <label class="property-label">Body text<textarea aria-label="Card body text" maxlength="500" rows="3" value={guiProperties().bodyText ?? ""} disabled={locked()} onInput={event => editText(event, current => updateGuiProperties(current, { bodyText: event.currentTarget.value }))} onBlur={finishTextEdit} /></label>
      <label class="property-label">Action label<input aria-label="Card action label" maxlength="120" value={guiProperties().actionLabel ?? "Details"} disabled={locked()} onInput={event => editText(event, current => updateGuiProperties(current, { actionLabel: event.currentTarget.value }))} onBlur={finishTextEdit} /></label>
      {renderOptionSpacing("Content", ["row"])}
    </Show>
    <Show when={kind() === "gui-app-bar"}>
      <label class="property-label">App title<input aria-label="App bar title" maxlength="120" value={guiProperties().title ?? "Workspace"} disabled={locked()} onInput={event => editText(event, current => updateGuiProperties(current, { title: event.currentTarget.value }))} onBlur={finishTextEdit} /></label>
      <label class="property-label">Account label<input aria-label="App bar account label" maxlength="12" value={guiProperties().actionLabel ?? "JD"} disabled={locked()} onInput={event => editText(event, current => updateGuiProperties(current, { actionLabel: event.currentTarget.value }))} onBlur={finishTextEdit} /></label>
    </Show>
    <Show when={kind() === "gui-navigation" || kind() === "gui-tabs"}>
      <Show when={kind() === "gui-navigation"}><label class="property-label">Navigation title<input aria-label="Navigation title" maxlength="120" value={guiProperties().title ?? "Workspace"} disabled={locked()} onInput={event => editText(event, current => updateGuiProperties(current, { title: event.currentTarget.value }))} onBlur={finishTextEdit} /></label></Show>
      <section class="component-options-editor">
        <header><strong>{kind() === "gui-navigation" ? "Navigation items" : "Tabs"}</strong><span>{(guiProperties().items ?? []).length}/12</span></header>
        {kind() === "gui-navigation" ? renderOptionSpacing("Item", ["row"]) : renderOptionSpacing("Item", ["column"])}
        <div class="component-property-choice"><span>Active item</span><div class="component-editor-choice-group component-editor-choice-wrap" role="group" aria-label="Active navigation item"><For each={(guiProperties().items ?? []).map((_, index) => index)}>{index => <button type="button" class={guiProperties().activeItem === index ? "active" : ""} aria-pressed={guiProperties().activeItem === index} disabled={locked()} onClick={() => changeGuiProperties({ activeItem: index })}>{guiProperties().items?.[index] || `Item ${index + 1}`}</button>}</For></div></div>
        <div class="component-option-list"><For each={(guiProperties().items ?? []).map((_, index) => index)}>{index => <div class="component-option-row"><span>{index + 1}</span><input aria-label={`${kind() === "gui-tabs" ? "Tab" : "Navigation item"} ${index + 1}`} maxlength="120" value={guiProperties().items?.[index] ?? ""} disabled={locked()} onInput={event => editText(event, current => updateGuiItem(current, index, event.currentTarget.value))} onBlur={finishTextEdit} /></div>}</For></div>
        <div class="component-option-actions"><button type="button" disabled={locked() || (guiProperties().items?.length ?? 0) <= 1} onClick={() => removeGuiItem((guiProperties().items?.length ?? 1) - 1)}>Remove</button><button type="button" disabled={locked() || (guiProperties().items?.length ?? 0) >= 12} onClick={addGuiItem}>Add item</button></div>
      </section>
    </Show>
    <Show when={kind() === "gui-image"}><label class="property-label">Placeholder label<input aria-label="Image placeholder label" maxlength="120" value={guiProperties().placeholder ?? "Image"} disabled={locked()} onInput={event => editText(event, current => updateGuiProperties(current, { placeholder: event.currentTarget.value }))} onBlur={finishTextEdit} /></label></Show>
    <Show when={kind() === "form-radio" || kind() === "form-select" || kind() === "form-button" || kind() === "form-checkbox"}>
      <section class="component-options-editor">
        <header><strong>{kind() === "form-button" ? "Button choices" : kind() === "form-checkbox" ? "Checkbox options" : kind() === "form-radio" ? "Radio options" : "Select options"}</strong><span>{options().length}/12</span></header>
        <Show when={kind() === "form-checkbox" || kind() === "form-radio" || kind() === "form-select"}>
          <Show when={kind() === "form-checkbox" || kind() === "form-radio"}><label class="property-label component-form-title">Title<input aria-label="Choice group title" maxlength="80" value={group().libraryComponent?.formTitle ?? defaultLibraryFormTitle(kind() as LibraryComponentKind) ?? ""} disabled={locked()} onInput={event => editText(event, current => setLibraryFormTitle(current, event.currentTarget.value))} onBlur={finishTextEdit} /></label></Show>
        </Show>
        <Show when={kind() === "form-checkbox" || kind() === "form-radio"}><div class="component-property-choice"><span>Title position</span><div class="component-editor-choice-group" role="group" aria-label="Choice group title position"><For each={titlePositions}>{position => <button type="button" class={guiProperties().titlePosition === position.value ? "active" : ""} aria-pressed={guiProperties().titlePosition === position.value} disabled={locked()} onClick={() => changeGuiProperties({ titlePosition: position.value })}>{position.label}</button>}</For></div></div>
          <div class="component-property-choice"><span>Options layout</span><div class="component-editor-choice-group" role="group" aria-label="Choice options layout"><For each={optionLayouts}>{layout => <button type="button" class={guiProperties().optionLayout === layout.value ? "active" : ""} aria-pressed={guiProperties().optionLayout === layout.value} disabled={locked()} onClick={() => changeGuiProperties({ optionLayout: layout.value })}>{layout.label}</button>}</For></div></div>
          {renderOptionSpacing("Option")}
          <Show when={guiProperties().optionLayout === "grid"}><label class="property-label">Grid columns<input aria-label="Choice grid columns" type="number" min="1" max={Math.max(1, options().length)} step="1" value={Math.min(options().length, guiProperties().optionColumns ?? 2)} disabled={locked()} onChange={event => changeGuiProperties({ optionColumns: Math.max(1, Math.min(options().length, Number(event.currentTarget.value) || 1)) })} /></label></Show>
        </Show>
        <div class="component-option-list"><For each={options().map((_, index) => index)}>{index => <div class="component-option-row">
          <span>{index + 1}</span>
          <Show when={kind() === "form-checkbox"}><input class="component-option-check" type="checkbox" aria-label={`Select ${options()[index] || `option ${index + 1}`}`} checked={group().libraryComponent?.formStates?.[index] ?? index === 0} disabled={locked()} onChange={event => changeGroup(current => setLibraryCheckboxOption(current, index, event.currentTarget.checked))} /></Show>
          <Show when={kind() === "form-radio"}><input class="component-option-radio" type="radio" name={`component-radio-${group().id}`} aria-label={`Choose ${options()[index] || `option ${index + 1}`}`} checked={(group().libraryComponent?.selectedOption ?? 0) === index} disabled={locked()} onChange={() => changeGroup(current => setLibraryRadioOption(current, index))} /></Show>
          <input aria-label={`Option ${index + 1} name`} maxlength="120" value={options()[index]} disabled={locked()} onInput={event => editText(event, current => updateOption(current, index, event.currentTarget.value))} onBlur={finishTextEdit} />
        </div>}</For></div>
        <div class="component-option-actions"><button type="button" disabled={locked() || options().length <= 1} onClick={removeOption}>Remove</button><button type="button" disabled={locked() || options().length >= 12} onClick={addOption}>Add option</button></div>
      </section>
      <Show when={kind() === "form-select" || kind() === "form-button"}><div class="component-property-choice"><span>Preview choice</span><div class="component-editor-choice-group component-editor-choice-wrap" role="group" aria-label="Preview component option"><For each={options().map((_, index) => index)}>{index => <button type="button" class={(group().libraryComponent?.selectedOption ?? 0) === index ? "active" : ""} aria-pressed={(group().libraryComponent?.selectedOption ?? 0) === index} disabled={locked()} onClick={() => changeSelectedOption(index)}>{options()[index] || `Option ${index + 1}`}</button>}</For></div></div></Show>
    </Show>
    <Show when={kind().startsWith("viz-")}><ChartEditor group={group} isDraft={props.isDraft} locked={locked} onChangeGroup={changeGroup} onCommitTextEdit={props.onCommitTextEdit}/></Show>
    <Show when={hasEditableText()}><label class="property-label">Font<input aria-label="Component font size" type="number" min="8" max="160" value={libraryComponentFontSize(group())} disabled={locked()} onChange={event => changeComponentFontSize(Number(event.currentTarget.value))} /></label></Show>
    <Show when={props.isDraft}><div class="component-draft-actions"><button type="button" class="quiet-button" onClick={props.onCancelDraft}>Cancel</button><button type="button" class="save-button" disabled={props.boardLocked()} onClick={props.onCommitDraft}>Add to canvas</button></div></Show>
  </div>;
}
