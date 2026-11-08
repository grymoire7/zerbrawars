import { isDebugStart } from "./arcModel";
import { clearNewPlayerData, parseFacilitator } from "./facilitatorModel";
import { clearHeld, heldRun } from "./heldRun";

/**
 * Facilitator mode, read once from the first URL and kept for the page session (later address
 * rewrites do not touch it). `debugPanel`: the start was a developer one (?mode=, ?seed= and the
 * rest), which keeps the Debug panel; a patient's start never shows it.
 */
export const facilitator = { on: false, debugPanel: true };

export function initFacilitator(params: URLSearchParams): void {
  facilitator.on = parseFacilitator(params);
  facilitator.debugPanel = isDebugStart(params);
}

/** Clears best scores, first-time help and the held summer. Returns whether a summer was held. */
export function resetForNewPlayer(): boolean {
  const hadHeld = heldRun() !== null;
  let storage: Storage | null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  clearNewPlayerData(storage);
  clearHeld();
  return hadHeld;
}
