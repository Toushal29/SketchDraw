import { For, Show } from "solid-js";
import type { FontFamily, StrokeStyle, StyleLibrary, StyleSlot } from "../../model";
import type { BindingState } from "./style-library";
import { MAX_STYLE_MODES, wouldCreateAliasCycle } from "./style-library";
import { MAX_COLOR_TOKENS, MAX_STROKE_STYLES, MAX_TEXT_STYLES, STYLE_SLOT_LABELS } from "./style-library";
import "./style-library-panel.css";

export type StyleSelectionSlot = { slot: StyleSlot; state: BindingState; tokenId?: string };
export type StyleLibraryPanelProps = {
  library: StyleLibrary;
  canEdit: boolean;
  /** Slots the current selection supports, with their binding state. Undefined when nothing is selected. */
  selection?: { label: string; slots: StyleSelectionSlot[] };
  usage: (slot: StyleSlot, tokenId: string) => number;
  fontChoices: readonly { value: FontFamily; label: string }[];
  resolveColor: (id: string) => string;
  onAddColor: (slot: "stroke" | "fill" | "text") => void;
  onUpdateColor: (id: string, patch: { name?: string; value?: string; aliasOf?: string | null }) => void;
  onEnableModes: () => void;
  onAddMode: () => void;
  onRenameMode: (id: string, name: string) => void;
  onRemoveMode: (id: string) => void;
  onSetMode: (id: string) => void;
  onFollowTheme: (enabled: boolean) => void;
  onRemoveColor: (id: string) => void;
  onAddTextStyle: () => void;
  onUpdateTextStyle: (id: string, patch: Record<string, unknown>) => void;
  onRemoveTextStyle: (id: string) => void;
  onAddStrokeStyle: () => void;
  onUpdateStrokeStyle: (id: string, patch: Record<string, unknown>) => void;
  onRemoveStrokeStyle: (id: string) => void;
  onApply: (slot: StyleSlot, tokenId: string) => void;
  onDetach: (slot: StyleSlot) => void;
  onClose: () => void;
};

const colorSlots = ["stroke", "fill", "text"] as const;
const slotSupported = (props: StyleLibraryPanelProps, slot: StyleSlot) => props.selection?.slots.some(item => item.slot === slot) ?? false;
const slotState = (props: StyleLibraryPanelProps, slot: StyleSlot) => props.selection?.slots.find(item => item.slot === slot);

/** Floating panel for named colors, text styles, and stroke styles. Edits update every element bound to a token. */
export function StyleLibraryPanel(props: StyleLibraryPanelProps) {
  const usageNote = (count: number) => count ? `${count} in use` : "unused";
  const applyButton = (slot: StyleSlot, id: string) => <Show when={slotSupported(props, slot)}>
    <button type="button" class="style-token-apply" classList={{ active: slotState(props, slot)?.tokenId === id && slotState(props, slot)?.state === "bound" }} disabled={!props.canEdit} aria-pressed={slotState(props, slot)?.tokenId === id && slotState(props, slot)?.state === "bound"} onClick={() => props.onApply(slot, id)}>
      {slotState(props, slot)?.tokenId === id && slotState(props, slot)?.state === "bound" ? "Applied" : "Apply"}
    </button>
  </Show>;
  return <aside class="style-library-panel" role="dialog" aria-label="Style library" onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); props.onClose(); } }}>
    <header><div><strong>Style library</strong><small>Change a style once and every object using it updates.</small></div><button type="button" class="help-close" aria-label="Close style library" onClick={props.onClose}>&times;</button></header>

    <Show when={props.selection} fallback={<p class="style-library-hint">Select objects to apply styles to them.</p>}>
      {selection => <section aria-label="Selection styles">
        <h3>Selected: {selection().label}</h3>
        <Show when={selection().slots.length} fallback={<p class="style-library-hint">This object has no stylable properties.</p>}>
          <ul class="style-selection-slots"><For each={selection().slots}>{item => <li>
            <span>{STYLE_SLOT_LABELS[item.slot]}</span>
            <small>{item.state === "bound" ? "linked" : item.state === "detached" ? "edited by hand" : "not linked"}</small>
            <Show when={item.state === "bound" || item.state === "detached"}><button type="button" class="style-token-apply" disabled={!props.canEdit} onClick={() => props.onDetach(item.slot)}>Unlink</button></Show>
          </li>}</For></ul>
        </Show>
      </section>}
    </Show>

    <section aria-label="Variable modes">
      <h3>Modes <small>{props.library.modes?.length ?? 0}/{MAX_STYLE_MODES}</small></h3>
      <Show when={props.library.modes?.length} fallback={<><p class="style-library-hint">Modes let one color style hold different values, such as Light and Dark, and switch the whole sketch at once.</p><div class="style-add-row"><button type="button" disabled={!props.canEdit} onClick={props.onEnableModes}>+ Light and Dark modes</button></div></>}>
        <div class="style-mode-row">
          <label>Active mode<select aria-label="Active style mode" value={props.library.activeModeId ?? props.library.modes![0].id} disabled={!props.canEdit} onChange={event => props.onSetMode(event.currentTarget.value)}><For each={props.library.modes}>{mode => <option value={mode.id}>{mode.name}</option>}</For></select></label>
          <input class="style-token-name" aria-label="Active mode name" maxlength="60" disabled={!props.canEdit} value={props.library.modes!.find(mode => mode.id === (props.library.activeModeId ?? props.library.modes![0].id))?.name ?? ""} onChange={event => props.onRenameMode(props.library.activeModeId ?? props.library.modes![0].id, event.currentTarget.value)} />
          <button type="button" disabled={!props.canEdit || (props.library.modes?.length ?? 0) >= MAX_STYLE_MODES} onClick={props.onAddMode}>+ Mode</button>
          <button type="button" class="style-token-remove" aria-label="Delete active mode" disabled={!props.canEdit || (props.library.modes?.length ?? 0) < 2} onClick={() => props.onRemoveMode(props.library.activeModeId ?? props.library.modes![0].id)}>&times;</button>
        </div>
        <label class="style-follow-theme"><input type="checkbox" checked={!!props.library.followTheme} disabled={!props.canEdit} onChange={event => props.onFollowTheme(event.currentTarget.checked)} /> Switch to the Light or Dark mode with the app theme</label>
      </Show>
    </section>

    <section aria-label="Color styles">
      <h3>Colors <small>{props.library.colors.length}/{MAX_COLOR_TOKENS}</small></h3>
      <div class="style-add-row" role="group" aria-label="Add color from selection">
        <For each={colorSlots}>{slot => <button type="button" disabled={!props.canEdit || props.library.colors.length >= MAX_COLOR_TOKENS} onClick={() => props.onAddColor(slot)}>+ {STYLE_SLOT_LABELS[slot]}</button>}</For>
      </div>
      <ul class="style-token-list"><For each={props.library.colors}>{token => <li>
        <input type="color" aria-label={`${token.name} value`} value={props.resolveColor(token.id)} disabled={!props.canEdit || !!token.aliasOf} title={token.aliasOf ? "Following another color style" : undefined} onInput={event => props.onUpdateColor(token.id, { value: event.currentTarget.value })} />
        <input class="style-token-name" aria-label="Color style name" maxlength="60" value={token.name} disabled={!props.canEdit} onChange={event => props.onUpdateColor(token.id, { name: event.currentTarget.value })} />
        <small>{usageNote(props.usage("stroke", token.id) + props.usage("fill", token.id) + props.usage("text", token.id))}</small>
        <label class="style-alias-row">Alias of<select aria-label={`${token.name} alias`} value={token.aliasOf ?? ""} disabled={!props.canEdit} onChange={event => props.onUpdateColor(token.id, { aliasOf: event.currentTarget.value || null })}><option value="">None (own value)</option><For each={props.library.colors.filter(other => other.id !== token.id && !wouldCreateAliasCycle(props.library, token.id, other.id))}>{other => <option value={other.id}>{other.name}</option>}</For></select></label>
        <span class="style-token-actions">
          <For each={colorSlots}>{slot => <Show when={slotSupported(props, slot)}><button type="button" class="style-token-apply" classList={{ active: slotState(props, slot)?.tokenId === token.id && slotState(props, slot)?.state === "bound" }} disabled={!props.canEdit} aria-label={`Use ${token.name} as ${STYLE_SLOT_LABELS[slot].toLowerCase()}`} aria-pressed={slotState(props, slot)?.tokenId === token.id && slotState(props, slot)?.state === "bound"} onClick={() => props.onApply(slot, token.id)}>{slot === "stroke" ? "Stroke" : slot === "fill" ? "Fill" : "Text"}</button></Show>}</For>
          <button type="button" class="style-token-remove" aria-label={`Delete ${token.name}`} disabled={!props.canEdit} onClick={() => props.onRemoveColor(token.id)}>&times;</button>
        </span>
      </li>}</For></ul>
      <Show when={!props.library.colors.length}><p class="style-library-hint">Select an object and add its stroke, fill, or text color as a named style.</p></Show>
    </section>

    <section aria-label="Text styles">
      <h3>Text styles <small>{props.library.textStyles.length}/{MAX_TEXT_STYLES}</small></h3>
      <div class="style-add-row"><button type="button" disabled={!props.canEdit || props.library.textStyles.length >= MAX_TEXT_STYLES} onClick={props.onAddTextStyle}>+ From selection</button></div>
      <ul class="style-token-list"><For each={props.library.textStyles}>{token => <li class="style-token-wide">
        <input class="style-token-name" aria-label="Text style name" maxlength="60" value={token.name} disabled={!props.canEdit} onChange={event => props.onUpdateTextStyle(token.id, { name: event.currentTarget.value })} />
        <div class="style-token-fields">
          <label>Size<input type="number" min="8" max="160" value={token.fontSize} disabled={!props.canEdit} onChange={event => props.onUpdateTextStyle(token.id, { fontSize: Number(event.currentTarget.value) })} /></label>
          <label>Font<select value={token.fontFamily} disabled={!props.canEdit} onChange={event => props.onUpdateTextStyle(token.id, { fontFamily: event.currentTarget.value })}><For each={props.fontChoices}>{font => <option value={font.value}>{font.label}</option>}</For></select></label>
          <button type="button" class="style-format" classList={{ active: !!token.bold }} aria-pressed={!!token.bold} aria-label="Bold" disabled={!props.canEdit} onClick={() => props.onUpdateTextStyle(token.id, { bold: !token.bold })}><b>B</b></button>
          <button type="button" class="style-format" classList={{ active: !!token.italic }} aria-pressed={!!token.italic} aria-label="Italic" disabled={!props.canEdit} onClick={() => props.onUpdateTextStyle(token.id, { italic: !token.italic })}><i>I</i></button>
          <button type="button" class="style-format" classList={{ active: !!token.underline }} aria-pressed={!!token.underline} aria-label="Underline" disabled={!props.canEdit} onClick={() => props.onUpdateTextStyle(token.id, { underline: !token.underline })}><u>U</u></button>
        </div>
        <small>{usageNote(props.usage("textStyle", token.id))}</small>
        <span class="style-token-actions">{applyButton("textStyle", token.id)}<button type="button" class="style-token-remove" aria-label={`Delete ${token.name}`} disabled={!props.canEdit} onClick={() => props.onRemoveTextStyle(token.id)}>&times;</button></span>
      </li>}</For></ul>
    </section>

    <section aria-label="Stroke styles">
      <h3>Stroke styles <small>{props.library.strokeStyles.length}/{MAX_STROKE_STYLES}</small></h3>
      <div class="style-add-row"><button type="button" disabled={!props.canEdit || props.library.strokeStyles.length >= MAX_STROKE_STYLES} onClick={props.onAddStrokeStyle}>+ From selection</button></div>
      <ul class="style-token-list"><For each={props.library.strokeStyles}>{token => <li class="style-token-wide">
        <input class="style-token-name" aria-label="Stroke style name" maxlength="60" value={token.name} disabled={!props.canEdit} onChange={event => props.onUpdateStrokeStyle(token.id, { name: event.currentTarget.value })} />
        <div class="style-token-fields">
          <label>Width<input type="number" min="1" max="64" value={token.thickness} disabled={!props.canEdit} onChange={event => props.onUpdateStrokeStyle(token.id, { thickness: Number(event.currentTarget.value) })} /></label>
          <label>Line<select value={token.lineStyle} disabled={!props.canEdit} onChange={event => props.onUpdateStrokeStyle(token.id, { lineStyle: event.currentTarget.value as StrokeStyle })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="double">Double</option></select></label>
        </div>
        <small>{usageNote(props.usage("strokeStyle", token.id))}</small>
        <span class="style-token-actions">{applyButton("strokeStyle", token.id)}<button type="button" class="style-token-remove" aria-label={`Delete ${token.name}`} disabled={!props.canEdit} onClick={() => props.onRemoveStrokeStyle(token.id)}>&times;</button></span>
      </li>}</For></ul>
    </section>
  </aside>;
}
