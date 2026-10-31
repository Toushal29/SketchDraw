import { Show } from "solid-js";
import type { SequenceStep } from "./sequence-playback";
import "./live-diagram-panel.css";

export type SequencePlaybackPanelProps = {
  steps: SequenceStep[];
  /** Index of the message shown, or -1 before the first step. */
  index: number;
  playing: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onReset: () => void;
  onClose: () => void;
};

/** Step through sequence-diagram messages in reading order to rehearse a flow. */
export function SequencePlaybackPanel(props: SequencePlaybackPanelProps) {
  const step = () => props.steps[props.index];
  return <aside class="live-diagram-panel sequence-playback-panel" role="dialog" aria-label="Sequence playback" onPointerDown={event => event.stopPropagation()} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); props.onClose(); } else if (event.key === "ArrowRight") { event.preventDefault(); props.onNext(); } else if (event.key === "ArrowLeft") { event.preventDefault(); props.onPrevious(); } }}>
    <header><strong>Sequence playback</strong><button type="button" class="help-close" aria-label="Close sequence playback" onClick={props.onClose}>&times;</button></header>
    <div class="live-diagram-controls">
      <button type="button" disabled={props.index <= 0} onClick={props.onPrevious}>Previous</button>
      <button type="button" aria-pressed={props.playing} onClick={props.onTogglePlay}>{props.playing ? "Pause" : "Play"}</button>
      <button type="button" disabled={props.index >= props.steps.length - 1} onClick={props.onNext}>Next</button>
      <button type="button" onClick={props.onReset}>Reset</button>
    </div>
    <p class="live-diagram-status ok" role="status" aria-live="polite">
      <Show when={step()} fallback={`${props.steps.length} message${props.steps.length === 1 ? "" : "s"}. Press Next to start.`}>
        {current => <>Step {props.index + 1} of {props.steps.length}: <strong>{current().from}</strong> to <strong>{current().to}</strong>: {current().label}</>}
      </Show>
    </p>
    <p class="live-diagram-hint">The current message and its two participants are selected on the canvas. Use the left and right arrow keys to step.</p>
  </aside>;
}
