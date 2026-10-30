import { describe, expect, it } from "vitest";
import { loadScenario } from "../scenarios";
import type { BattleGrade, BattleState } from "../types";
import { validateBattle } from "../validate";
import { BOTS, playBattle } from "./bots";

// Headless balance check: every bot plays the same seeded battles. See the table with
// `npx vitest run src/sim/battle/balance.test.ts --silent=false`. "best" is the share of seeds
// where a bot graded at least as well as every other choosing bot. The thresholds are the design targets, so a param or scenario change that breaks
// them should be a conscious one.

const SEEDS = 300;
const GRADES: BattleGrade[] = ["cleared", "contained", "neededBackup"];
const SCORE: Record<BattleGrade, number> = {
  cleared: 2,
  contained: 1,
  neededBackup: 0,
};
/** Bots that make choices (hold and random are baselines). */
const PLAYERS = Object.keys(BOTS).filter((n) => n !== "hold" && n !== "random");

interface Row {
  grades: Record<BattleGrade, number>;
  scores: number[];
  tissue: number;
  turns: number;
}

function survey(name: string): Row {
  const row: Row = {
    grades: { cleared: 0, contained: 0, neededBackup: 0 },
    scores: [],
    tissue: 0,
    turns: 0,
  };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const start = loadScenario("first-board", seed) as BattleState;
    const { outcome, final } = playBattle(BOTS[name], start, seed);
    expect(validateBattle(final)).toEqual([]);
    row.grades[outcome.grade]++;
    row.scores.push(SCORE[outcome.grade]);
    row.tissue += outcome.tissue.health / SEEDS;
    row.turns += outcome.turnsPlayed / SEEDS;
  }
  return row;
}

describe("balance bots on first-board", () => {
  const rows: Record<string, Row> = Object.fromEntries(
    Object.keys(BOTS).map((name) => [name, survey(name)]),
  );
  /** Share of seeds where the bot did at least as well as every other player bot. */
  const bestOrTied = (name: string) =>
    rows[name].scores.filter((s, i) =>
      PLAYERS.every((m) => s >= rows[m].scores[i]),
    ).length / SEEDS;
  const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(6);

  it("prints the outcome table", () => {
    const lines = Object.entries(rows).map(
      ([name, r]) =>
        name.padEnd(13) +
        GRADES.map((g) => pct(r.grades[g] / SEEDS)).join("") +
        (PLAYERS.includes(name) ? pct(bestOrTied(name)) : "     -") +
        `  ${r.tissue.toFixed(1).padStart(5)}  ${r.turns.toFixed(1)}`,
    );
    // The sim's tsconfig has no DOM or Node types, so reach console through globalThis.
    (
      globalThis as unknown as { console: { log(s: string): void } }
    ).console.log(
      ["bot          clear  cont  back  best tissue turns", ...lines].join(
        "\n",
      ),
    );
  });

  it("sends a do-nothing player, or one that ignores sealed pathogens, to backup", () => {
    expect(rows.hold.grades.neededBackup).toBe(SEEDS);
    expect(rows.leakyOnly.grades.neededBackup).toBe(SEEDS);
  });

  it("makes cleared reachable but never the sure thing", () => {
    expect(
      Math.max(...PLAYERS.map((n) => rows[n].grades.cleared)),
    ).toBeGreaterThan(SEEDS * 0.2);
    for (const n of PLAYERS)
      expect(rows[n].grades.cleared, n).toBeLessThan(SEEDS * 0.6);
  });

  it("lets no simple strategy dominate", () => {
    for (const n of PLAYERS) expect(bestOrTied(n), n).toBeLessThan(0.85);
  });
});
