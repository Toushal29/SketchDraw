/** Keep raw and coalesced pointer events ordered within each stroke. */
export function createStrokeSampleGate() {
  let pointerTime = -Infinity;

  return {
    reset(startTime = -Infinity) { pointerTime = startTime; },
    accept(time: number) {
      if (!Number.isFinite(time) || time <= pointerTime) return false;
      pointerTime = time;
      return true;
    },
  };
}
