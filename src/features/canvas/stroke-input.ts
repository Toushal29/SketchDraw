/** Keep raw/coalesced events ordered and use one sample clock per stroke. */
export function createStrokeSampleGate() {
  let source: "pointer" | "native" | undefined;
  let pointerTime = -Infinity;
  let nativeTime = -Infinity;

  return {
    reset(startTime = -Infinity) { source = undefined; pointerTime = startTime; nativeTime = -Infinity; },
    accept(candidate: "pointer" | "native", time: number) {
      if (!Number.isFinite(time) || source && source !== candidate) return false;
      const previous = candidate === "pointer" ? pointerTime : nativeTime;
      if (time <= previous) return false;
      source = candidate;
      if (candidate === "pointer") pointerTime = time; else nativeTime = time;
      return true;
    },
  };
}
