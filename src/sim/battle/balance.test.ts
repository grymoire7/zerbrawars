import { describe, expect, it } from "vitest";
import { firstBoardLoadout } from "../scenarios";
import type { BattleGrade } from "../types";
import { validateBattle } from "../validate";
import { BOTS, playBattle, SUPPORT_BOTS, type SupportBot } from "./bots";
import { battleFromLoadout } from "./setup";

// Headless balance check: every bot plays the same seeded first-board battles at four med
// levels, spending charges with the eager support bot. See the tables with
// `npx vitest run src/sim/battle/balance.test.ts --silent=false`. "best" is the share of seeds
// where a bot graded at least as well as every other choosing bot at that level. The thresholds
// are the design targets, so a param or scenario change that breaks them should be a conscious
// one.

const SEEDS = 300;
const LEVELS = [1, 0.6, 0.3, 0];
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
}

function survey(name: string, level: number, support: SupportBot): Row {
  const row: Row = {
    grades: { cleared: 0, contained: 0, neededBackup: 0 },
    scores: [],
    tissue: 0,
  };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const start = battleFromLoadout(firstBoardLoadout(seed, level));
    const { outcome, final } = playBattle(BOTS[name], start, seed, support);
    expect(validateBattle(final)).toEqual([]);
    row.grades[outcome.grade]++;
    row.scores.push(SCORE[outcome.grade]);
    row.tissue += outcome.tissue.health / SEEDS;
  }
  return row;
}

const share = (r: Row, g: BattleGrade) => r.grades[g] / SEEDS;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("balance bots on first-board by med level", () => {
  const rows = LEVELS.map((level) => ({
    level,
    bots: Object.fromEntries(
      Object.keys(BOTS).map((name) => [
        name,
        survey(name, level, SUPPORT_BOTS.eager),
      ]),
    ) as Record<string, Row>,
    plain: {
      hold: survey("hold", level, SUPPORT_BOTS.none),
      leakyOnly: survey("leakyOnly", level, SUPPORT_BOTS.none),
    },
  }));
  /** Share of seeds where the bot did at least as well as every other player bot. */
  const bestOrTied = (bots: Record<string, Row>, name: string) =>
    bots[name].scores.filter((s, i) =>
      PLAYERS.every((m) => s >= bots[m].scores[i]),
    ).length / SEEDS;
  const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(6);

  it("prints the outcome tables", () => {
    const lines = rows.flatMap(({ level, bots }) => [
      `med ${Math.round(level * 100)}%`,
      "bot          clear  cont  back  best tissue",
      ...Object.entries(bots).map(
        ([name, r]) =>
          name.padEnd(13) +
          GRADES.map((g) => pct(share(r, g))).join("") +
          (PLAYERS.includes(name) ? pct(bestOrTied(bots, name)) : "     -") +
          `  ${r.tissue.toFixed(1).padStart(5)}`,
      ),
    ]);
    // The sim's tsconfig has no DOM or Node types, so reach console through globalThis.
    (
      globalThis as unknown as { console: { log(s: string): void } }
    ).console.log(lines.join("\n"));
  });

  it("sends a do-nothing player to backup at every level, charges or not", () => {
    for (const { bots, plain } of rows) {
      expect(bots.hold.grades.neededBackup).toBe(SEEDS);
      expect(plain.hold.grades.neededBackup).toBe(SEEDS);
    }
  });

  it("sends a player who ignores sealed pathogens to backup without charges", () => {
    for (const { plain } of rows) {
      expect(plain.leakyOnly.grades.neededBackup).toBe(SEEDS);
    }
  });

  it("makes cleared reachable at every level but never the sure thing", () => {
    for (const { level, bots } of rows) {
      const best = Math.max(...PLAYERS.map((n) => share(bots[n], "cleared")));
      expect(best, `med ${level}`).toBeGreaterThan(0.2);
      expect(best, `med ${level}`).toBeLessThan(0.85);
    }
  });

  // Ties count as best, and at the mid levels most bots tie on "contained", so the bar is 0.9
  // (it was 0.85 with one level and no charges, when the best bot sat at 80%).
  it("lets no simple strategy dominate at any level", () => {
    for (const { level, bots } of rows) {
      for (const n of PLAYERS)
        expect(bestOrTied(bots, n), `${n} at med ${level}`).toBeLessThan(0.9);
    }
  });

  it("shifts outcomes clearly with the med level", () => {
    const at = (level: number) =>
      (rows.find((r) => r.level === level) as (typeof rows)[number]).bots;
    const ceiling = (level: number) =>
      Math.max(...PLAYERS.map((n) => share(at(level)[n], "cleared")));
    const backup = (level: number) =>
      mean(PLAYERS.map((n) => share(at(level)[n], "neededBackup")));
    // Full meds raise the ceiling: two antifungal charges finish the mold without dice.
    expect(ceiling(1)).toBeGreaterThan(ceiling(0.6) + 0.2);
    // Fewer meds, more backup for the same play. 30% and 0% differ only by a faint aura.
    expect(backup(0.6)).toBeGreaterThan(backup(1) + 0.03);
    expect(backup(0.3)).toBeGreaterThan(backup(1) + 0.08);
    expect(backup(0)).toBeGreaterThanOrEqual(backup(0.3));
    // The careful line loses ground at every step down.
    const careful = LEVELS.map((l) => mean(at(l).careful.scores));
    for (let i = 1; i < careful.length; i++)
      expect(careful[i]).toBeLessThanOrEqual(careful[i - 1]);
    expect(careful[0] - careful[careful.length - 1]).toBeGreaterThan(0.15);
  });
});
