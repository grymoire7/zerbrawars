import type { Run } from "./run";

// The Arc 2 run that waits while the player is on the title (Continue). It lives only as long as
// the page: nothing is saved, so a reload drops it.

let held: Run | null = null;

/** The summer waiting to be continued, if any. */
export const heldRun = (): Run | null => held;

/** Holds `run`, replacing any run already held. */
export function holdRun(run: Run): void {
  held = run;
}

/**
 * Lets go of the held run. Given a run, only if that is the one held (a finished summary clears
 * its own run and never a newer one).
 */
export function clearHeld(run?: Run): void {
  if (run === undefined || held === run) held = null;
}
