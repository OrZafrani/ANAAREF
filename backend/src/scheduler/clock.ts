import { setTimeout as sleep } from 'node:timers/promises';

export interface Clock {
  now(): Date;
  /** Resolves at `time` (immediately if it has passed). Rejects with an AbortError when `signal` aborts. */
  sleepUntil(time: Date, signal: AbortSignal): Promise<void>;
}

// Sleep in slices and re-read the wall clock, so a long wait stays accurate
// if the system clock jumps (e.g. a laptop waking from sleep).
const MAX_SLEEP_MS = 60_000;

export const systemClock: Clock = {
  now: () => new Date(),

  async sleepUntil(time, signal) {
    for (;;) {
      signal.throwIfAborted();
      const remainingMs = time.getTime() - Date.now();
      if (remainingMs <= 0) return;
      await sleep(Math.min(remainingMs, MAX_SLEEP_MS), undefined, { signal });
    }
  },
};
