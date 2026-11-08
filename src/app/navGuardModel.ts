/** What browser Back (or the Android back gesture) does on a play screen. */
export type BackAction = "closeMenu" | "closeHelp" | "openMenu" | "none";

export function backAction(s: {
  readonly menuOpen: boolean;
  readonly helpOpen: boolean;
  /** A question that must be answered (the probe) is open: Back leaves it alone. */
  readonly blocked: boolean;
}): BackAction {
  if (s.blocked) return "none";
  if (s.menuOpen) return "closeMenu";
  if (s.helpOpen) return "closeHelp";
  return "openMenu";
}

/**
 * Whether a reload or tab close should ask "Leave site?". Only when something would be lost: a
 * summer held for Continue, or an arc fight in play (neither is saved). The title with nothing
 * held, a finished summer and the debug entries ask nothing.
 */
export function shouldWarnOnLeave(s: {
  readonly held: boolean;
  readonly arcFightInPlay: boolean;
}): boolean {
  return s.held || s.arcFightInPlay;
}

/** The marker on the one history entry the guard keeps above the page's own. */
export const GUARD_STATE = { zebrawarsBackGuard: 1 } as const;

export function isGuardState(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as Record<string, unknown>).zebrawarsBackGuard === 1
  );
}

/**
 * What the guard must do with the history stack, given whether the screen wants Back caught and
 * whether the current entry is already the guard entry. The stack never holds more than one.
 */
export function historyStep(s: {
  readonly wantGuard: boolean;
  readonly onGuardEntry: boolean;
}): "push" | "pop" | "none" {
  if (s.wantGuard) return s.onGuardEntry ? "none" : "push";
  return s.onGuardEntry ? "pop" : "none";
}
