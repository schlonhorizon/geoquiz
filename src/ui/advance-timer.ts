export const AUTO_ADVANCE_MS = 5_000;

export function createAdvanceTimer(onPauseChange: (paused: boolean) => void, onElapsed: () => void) {
  const pauses = new Set<string>();
  let remaining = 0;
  let startedAt = 0;
  let timeout: number | undefined;

  function resume() {
    startedAt = performance.now();
    timeout = window.setTimeout(() => {
      timeout = undefined;
      remaining = 0;
      onElapsed();
    }, remaining);
  }

  function stop() {
    window.clearTimeout(timeout);
    timeout = undefined;
    remaining = 0;
  }

  return {
    start() {
      stop();
      remaining = AUTO_ADVANCE_MS;
      onPauseChange(pauses.size > 0);
      if (!pauses.size) resume();
    },
    stop,
    setPaused(source: string, paused: boolean) {
      const wasPaused = pauses.size > 0;
      if (paused) pauses.add(source);
      else pauses.delete(source);
      const isPaused = pauses.size > 0;
      if (!remaining || wasPaused === isPaused) return;

      onPauseChange(isPaused);
      if (isPaused) {
        window.clearTimeout(timeout);
        timeout = undefined;
        remaining = Math.max(0, remaining - (performance.now() - startedAt));
        if (!remaining) onElapsed();
      } else {
        resume();
      }
    },
  };
}
