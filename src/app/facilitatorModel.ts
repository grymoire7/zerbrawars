import { BEST_KEY } from "./bestScores";
import { HELP_SEEN_KEYS } from "../ui/help";

/** Facilitator mode is on for the page session when the URL says `?facilitator=1`. */
export const parseFacilitator = (params: URLSearchParams): boolean =>
  params.get("facilitator") === "1";

export const FACILITATOR_HEADING = "For the facilitator";
export const PROBE_LABEL = "Prediction probe on turns 2, 4 and 6";
export const BROUGHT_LABEL = "Show what you brought in";
export const EXPORT_LABEL = "Export log";
export const COPY_LABEL = "Copy log";
export const RESET_LABEL = "Reset for a new player";

/** The in-menu confirm for Reset for a new player (the words come from the navigation design). */
export const RESET_CONFIRM = {
  question: "Clear best scores and first-time help for a new player?",
  detail: "A summer that is waiting on the title will end too.",
  keep: "Cancel",
  go: "Clear",
};

export const SAVED_LINE = "Saved a file.";
export const COPIED_LINE = "Copied.";
export const COPY_BLOCKED_LINE = "Copy was blocked. Use Export log.";

/** What a confirm that loses a run adds, for a facilitator who can still save the log. */
export const EXPORT_FIRST = {
  line: "The session log goes with it. Export it first?",
  button: EXPORT_LABEL,
};

/** The export-first line and button, or null: only with the flag on and a log to save. */
export function exportFirst(
  facilitator: boolean,
  hasLog: boolean,
): typeof EXPORT_FIRST | null {
  return facilitator && hasLog ? EXPORT_FIRST : null;
}

/** The title's small Export log item: with the flag and a held run, never otherwise. */
export function titleExport(
  facilitator: boolean,
  hasHeld: boolean,
): { label: string; sub: string } | null {
  return facilitator && hasHeld
    ? { label: EXPORT_LABEL, sub: "Save this summer's session log as a file." }
    : null;
}

export const logFileName = (seed: number): string =>
  `zebrawars-session-seed${seed}.json`;

/** What the card says once Reset for a new player has run. */
export function clearedLine(hadHeld: boolean): string {
  return hadHeld
    ? "Cleared: best scores, first-time help and the waiting summer."
    : "Cleared: best scores and first-time help.";
}

/** The part of a Storage that clearing needs. */
export interface ClearStorage {
  removeItem(key: string): void;
}

/** Every localStorage key a new player should not inherit: best scores and the help-seen flags. */
export const NEW_PLAYER_KEYS: readonly string[] = [BEST_KEY, ...HELP_SEEN_KEYS];

/** Removes the stored data of the last player. Blocked or missing storage is skipped, not fatal. */
export function clearNewPlayerData(storage: ClearStorage | null): void {
  for (const key of NEW_PLAYER_KEYS) {
    try {
      storage?.removeItem(key);
    } catch {
      // Blocked storage has nothing of ours to clear.
    }
  }
}
