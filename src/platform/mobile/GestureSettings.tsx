import { Show } from "solid-js";

export type TouchTapAction = "none" | "undo" | "redo" | "select" | "pan" | "fit" | "resetZoom" | "layers" | "grid" | "properties" | "tools" | "clearSelection";
export type OneFingerDragAction = "activeTool" | "pan";
export type TouchGestureAction = "none" | "pan" | "zoom" | "panZoom";

export const TOUCH_TAP_ACTIONS: { value: TouchTapAction; label: string }[] = [
  { value: "none", label: "Do nothing" }, { value: "undo", label: "Undo" }, { value: "redo", label: "Redo" },
  { value: "select", label: "Switch to Select" }, { value: "pan", label: "Switch to Pan" },
  { value: "fit", label: "Fit drawing" }, { value: "resetZoom", label: "Reset zoom to 100%" },
  { value: "layers", label: "Toggle Layers panel" }, { value: "grid", label: "Toggle grid" },
  { value: "properties", label: "Toggle properties" }, { value: "tools", label: "Toggle tool dock" },
  { value: "clearSelection", label: "Clear selection" },
];

export const TOUCH_GESTURE_ACTIONS: { value: TouchGestureAction; label: string }[] = [
  { value: "none", label: "Do nothing" }, { value: "panZoom", label: "Pan and zoom" },
  { value: "pan", label: "Pan canvas" }, { value: "zoom", label: "Zoom only" },
];

export function readTouchTapAction(key: string, fallback: TouchTapAction): TouchTapAction {
  try {
    const stored = localStorage.getItem(key);
    return TOUCH_TAP_ACTIONS.some(({ value }) => value === stored) ? stored as TouchTapAction : fallback;
  } catch { return fallback; }
}

export function readTouchGestureAction(key: string, fallback: TouchGestureAction): TouchGestureAction {
  try {
    const stored = localStorage.getItem(key);
    return TOUCH_GESTURE_ACTIONS.some(({ value }) => value === stored) ? stored as TouchGestureAction : fallback;
  } catch { return fallback; }
}

type Props = {
  section: "taps" | "gestures";
  onSectionChange: (section: "taps" | "gestures") => void;
  oneFingerTapAction: TouchTapAction;
  twoFingerTapAction: TouchTapAction;
  threeFingerTapAction: TouchTapAction;
  oneFingerDragAction: OneFingerDragAction;
  twoFingerGestureAction: TouchGestureAction;
  threeFingerGestureAction: TouchGestureAction;
  onTapChange: (fingers: "one" | "two" | "three", action: TouchTapAction) => void;
  onGestureChange: (fingers: 1 | 2 | 3, action: string) => void;
  detailsRef: (element: HTMLDetailsElement) => void;
};

export function GestureSettings(props: Props) {
  return <details class="menu-dropdown touch-gesture-menu" ref={props.detailsRef}>
    <summary>Gestures<svg viewBox="0 0 16 16"><path d="m4 6 4 4 4-4" /></svg></summary>
    <div class="system-menu-popover gesture-settings-popover">
      <header class="gesture-menu-heading"><div><span class="eyebrow">TOUCH CONTROLS</span><strong>{props.section === "taps" ? "Tap actions" : "Finger movements"}</strong><p>Tap assignments and movement gestures have separate settings.</p></div></header>
      <nav class="gesture-menu-tabs" aria-label="Touch settings">
        <button class={props.section === "taps" ? "active" : ""} aria-pressed={props.section === "taps"} onClick={() => props.onSectionChange("taps")}>Tap actions</button>
        <button class={props.section === "gestures" ? "active" : ""} aria-pressed={props.section === "gestures"} onClick={() => props.onSectionChange("gestures")}>Finger movements</button>
      </nav>
      <Show when={props.section === "taps"}>
        <div class="gesture-action-grid">
          <label class="gesture-action-card"><span class="gesture-finger-badge">1</span><span class="gesture-card-copy"><strong>One finger</strong><small>Tap</small></span><select aria-label="One finger tap action" value={props.oneFingerTapAction} onChange={event => props.onTapChange("one", event.currentTarget.value as TouchTapAction)}>{TOUCH_TAP_ACTIONS.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
          <label class="gesture-action-card"><span class="gesture-finger-badge">2</span><span class="gesture-card-copy"><strong>Two fingers</strong><small>Tap together</small></span><select aria-label="Two finger tap action" value={props.twoFingerTapAction} onChange={event => props.onTapChange("two", event.currentTarget.value as TouchTapAction)}>{TOUCH_TAP_ACTIONS.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
          <label class="gesture-action-card"><span class="gesture-finger-badge">3</span><span class="gesture-card-copy"><strong>Three fingers</strong><small>Tap together</small></span><select aria-label="Three finger tap action" value={props.threeFingerTapAction} onChange={event => props.onTapChange("three", event.currentTarget.value as TouchTapAction)}>{TOUCH_TAP_ACTIONS.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
        </div>
        <p class="gesture-menu-note">These actions run only when the fingers tap without moving.</p>
      </Show>
      <Show when={props.section === "gestures"}>
        <div class="gesture-action-grid">
          <label class="gesture-action-card"><span class="gesture-finger-badge">1</span><span class="gesture-card-copy"><strong>One-finger drag</strong><small>Move one finger</small></span><select aria-label="One finger drag action" value={props.oneFingerDragAction} onChange={event => props.onGestureChange(1, event.currentTarget.value)}><option value="activeTool">Use active tool</option><option value="pan">Pan canvas</option></select></label>
          <label class="gesture-action-card"><span class="gesture-finger-badge">2</span><span class="gesture-card-copy"><strong>Two-finger move</strong><small>Move or pinch</small></span><select aria-label="Two finger gesture action" value={props.twoFingerGestureAction} onChange={event => props.onGestureChange(2, event.currentTarget.value)}>{TOUCH_GESTURE_ACTIONS.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
          <label class="gesture-action-card"><span class="gesture-finger-badge">3</span><span class="gesture-card-copy"><strong>Three-finger move</strong><small>Move or pinch</small></span><select aria-label="Three finger gesture action" value={props.threeFingerGestureAction} onChange={event => props.onGestureChange(3, event.currentTarget.value)}>{TOUCH_GESTURE_ACTIONS.map(option => <option value={option.value}>{option.label}</option>)}</select></label>
        </div>
        <p class="gesture-menu-note">Finger movement settings do not change tap actions. Stylus input continues to use the active tool.</p>
      </Show>
    </div>
  </details>;
}
