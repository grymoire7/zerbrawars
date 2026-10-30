import { PARAMS } from "../params";
import type { Dose } from "./types";

/**
 * Med level: the share of doses taken over the last PARAMS.life.meds.window days, so 1, 0.67,
 * 0.33 or 0 with a window of 3. A missed dose dims the aura at once and keeps it dim until it
 * leaves the window; a second miss stacks. Fewer doses than the window count as taken (a player
 * arrives on their meds).
 */
export function medLevelOf(doses: readonly Dose[]): number {
  const w = PARAMS.life.meds.window;
  const recent = doses.slice(-w);
  const missed = recent.filter((d) => !d.taken).length;
  return (w - missed) / w;
}

/** Doses taken in a row at the end of the history. */
export function streakOf(doses: readonly Dose[]): number {
  let n = 0;
  for (let i = doses.length - 1; i >= 0 && doses[i].taken; i--) n++;
  return n;
}

/** The pre-week days that fill the window: all taken. */
export function preWeekDoses(week: number): Dose[] {
  const w = PARAMS.life.meds.window;
  return Array.from({ length: w }, (_, i) => ({
    week: week - 1,
    day: PARAMS.life.days - w + i,
    taken: true,
    cause: "default" as const,
  }));
}
