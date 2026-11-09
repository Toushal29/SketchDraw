import { createSignal, Show, onCleanup } from "solid-js";
import { dailyChallenge, randomChallenge, createChallengeTimer, type DrawingChallenge } from "../features/canvas/drawing-challenges";

type Props = {
  onClose: () => void;
};

export function DrawingChallengePanel(props: Props) {
  const [challenge, setChallenge] = createSignal<DrawingChallenge>(dailyChallenge());
  const [running, setRunning] = createSignal(false);
  const [remaining, setRemaining] = createSignal(0);
  const [completed, setCompleted] = createSignal(false);

  let timer: ReturnType<typeof createChallengeTimer> | undefined;

  function startChallenge() {
    if (timer) timer.stop();
    const ch = challenge();
    setRemaining(ch.timeLimit);
    setCompleted(false);
    setRunning(true);
    timer = createChallengeTimer(
      ch,
      (r) => setRemaining(r),
      () => { setRunning(false); setCompleted(true); },
    );
    timer.start();
  }

  function stopChallenge() {
    if (timer) timer.stop();
    setRunning(false);
  }

  function newDaily() {
    stopChallenge();
    setChallenge(dailyChallenge());
    setCompleted(false);
  }

  function newRandom(difficulty?: DrawingChallenge["difficulty"]) {
    stopChallenge();
    setChallenge(randomChallenge(difficulty));
    setCompleted(false);
  }

  onCleanup(() => { if (timer) timer.stop(); });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const difficultyColor = (d: string) => d === "easy" ? "var(--theme-success)" : d === "hard" ? "var(--theme-error)" : "var(--theme-warning)";

  return <aside class="drawing-challenge-panel" aria-label="Drawing challenge">
    <header>
      <strong>Drawing Challenge</strong>
      <button type="button" aria-label="Close" onClick={props.onClose}>×</button>
    </header>
    <div class="challenge-card">
      <span class="challenge-difficulty" style={{ color: difficultyColor(challenge().difficulty) }}>{challenge().difficulty}</span>
      <h3 class="challenge-prompt">{challenge().prompt}</h3>
      <ul class="challenge-constraints">
        {challenge().constraints.map(c => <li>{c}</li>)}
      </ul>
      <Show when={running()}>
        <div class="challenge-timer" classList={{ "challenge-timer-urgent": remaining() <= 10 }}>
          {formatTime(remaining())}
        </div>
      </Show>
      <Show when={completed()}>
        <div class="challenge-complete">Time's up!</div>
      </Show>
    </div>
    <div class="challenge-actions">
      <Show when={!running()} fallback={<button type="button" onClick={stopChallenge}>Stop</button>}>
        <button type="button" class="challenge-start" onClick={startChallenge}>Start ({formatTime(challenge().timeLimit)})</button>
      </Show>
      <button type="button" onClick={newDaily}>Daily</button>
      <button type="button" onClick={() => newRandom()}>Random</button>
    </div>
    <div class="challenge-difficulty-picker">
      <button type="button" onClick={() => newRandom("easy")}>Easy</button>
      <button type="button" onClick={() => newRandom("medium")}>Medium</button>
      <button type="button" onClick={() => newRandom("hard")}>Hard</button>
    </div>
  </aside>;
}
