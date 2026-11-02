// Best scores, kept in localStorage (docs/specs/b1a-design.md section 1.5). One key holding every
// entry; every storage access is wrapped, so a missing, blocked, full or throwing storage behaves
// as "nothing saved" and the game plays on. This is stats for the player's own eyes, never state
// the game depends on.

export const BEST_KEY = "zebrawars.best";
const FORMAT = 1;
const MAX_ENTRIES = 50;

/** The two pieces of storage this module uses; a fake can stand in for tests. */
export interface BestStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BestEntry {
  /** Best total on this id. */
  readonly total: number;
  /** Best Choices on its own; it can come from a different run than the best total. */
  readonly choices: number;
  /** The Outcome of the run that holds the best total. */
  readonly outcome: number;
  /** Finished runs recorded on this id. */
  readonly runs: number;
  /** ISO date of the latest record. */
  readonly at: string;
}

export interface RunScore {
  readonly total: number;
  readonly choices: number;
  readonly outcome: number;
}

export interface RecordResult {
  /** The entry after recording; null when storage could not be written. */
  readonly entry: BestEntry | null;
  /** The entry before this run, if any. */
  readonly previous: BestEntry | null;
  readonly newBestTotal: boolean;
  readonly newBestChoices: boolean;
  /** False when storage was missing or threw: show no best line. */
  readonly stored: boolean;
}

export interface BestKey {
  readonly scoreVersion: number;
  readonly arc: string;
  readonly variant: string;
  readonly seed: number;
}

export const bestId = (k: BestKey) =>
  `${k.scoreVersion}|${k.arc}|${k.variant}|${k.seed}`;

/** The browser's storage, looked up on use because even reading the property can throw. */
function browserStorage(): BestStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isNum = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

function validEntry(e: unknown): e is BestEntry {
  if (typeof e !== "object" || e === null) return false;
  const o = e as Record<string, unknown>;
  return (
    isNum(o.total) &&
    isNum(o.choices) &&
    isNum(o.outcome) &&
    isNum(o.runs) &&
    typeof o.at === "string"
  );
}

/** Every saved entry by id; empty when storage is missing, throws or holds something malformed. */
export function loadBest(
  storage: BestStorage | null = browserStorage(),
): Record<string, BestEntry> {
  const out: Record<string, BestEntry> = {};
  try {
    const raw = storage?.getItem(BEST_KEY);
    if (!raw) return out;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return out;
    const d = data as { v?: unknown; entries?: unknown };
    if (d.v !== FORMAT || typeof d.entries !== "object" || d.entries === null)
      return out;
    for (const [id, e] of Object.entries(d.entries)) {
      if (validEntry(e)) out[id] = e;
    }
  } catch {
    return {};
  }
  return out;
}

/** The best entry for one id, or null. */
export function readBest(
  id: string,
  storage: BestStorage | null = browserStorage(),
): BestEntry | null {
  return loadBest(storage)[id] ?? null;
}

/** Records a finished run. Never throws. */
export function recordRun(
  id: string,
  score: RunScore,
  storage: BestStorage | null = browserStorage(),
  now: () => Date = () => new Date(),
): RecordResult {
  const entries = loadBest(storage);
  const previous = entries[id] ?? null;
  const newBestTotal = previous === null || score.total > previous.total;
  const newBestChoices = previous === null || score.choices > previous.choices;
  const entry: BestEntry = {
    total: newBestTotal ? score.total : (previous?.total ?? score.total),
    choices: newBestChoices
      ? score.choices
      : (previous?.choices ?? score.choices),
    outcome: newBestTotal
      ? score.outcome
      : (previous?.outcome ?? score.outcome),
    runs: (previous?.runs ?? 0) + 1,
    at: now().toISOString(),
  };
  entries[id] = entry;
  const kept = Object.entries(entries)
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .slice(0, MAX_ENTRIES);
  try {
    if (!storage) throw new Error("no storage");
    storage.setItem(
      BEST_KEY,
      JSON.stringify({ v: FORMAT, entries: Object.fromEntries(kept) }),
    );
  } catch {
    return {
      entry: null,
      previous,
      newBestTotal: false,
      newBestChoices: false,
      stored: false,
    };
  }
  return { entry, previous, newBestTotal, newBestChoices, stored: true };
}

/** Saved entries for one variant, best first (the title/hub in B3 shows these). */
export function listBest(
  variant: string,
  storage: BestStorage | null = browserStorage(),
): { id: string; entry: BestEntry }[] {
  return Object.entries(loadBest(storage))
    .filter(([id]) => id.split("|")[2] === variant)
    .map(([id, entry]) => ({ id, entry }))
    .sort((a, b) => b.entry.total - a.entry.total);
}
