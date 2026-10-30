import { describe, expect, it } from "vitest";
import { BOTS, playBattle, SUPPORT_BOTS } from "../battle/bots";
import { battleFromLoadout } from "../battle/setup";
import type { BattleGrade, BattleOutcome, BattleState } from "../types";
import { LIFE_BOTS, playWeek } from "./bots";
import { battleDue, loadoutFromLife } from "./loadout";

// Headless life-to-battle balance: each life strategy plays the same seeded weeks; any battle that
// follows is played by bestPlay (below). See the table with
// `npx vitest run src/sim/life/balance.test.ts --silent=false`. With nothing landed the week
// skirmishes ("skirm" cleared, "loose" not); "score" counts a cleared skirmish 3 (dodging the
// exposure stays the best week), a loose one 1, a full battle cleared 2, contained 1, backup 0;
// "tissue" is the mean tissue lost.
// The thresholds are the design targets.

const SEEDS = 400;
type Result = BattleGrade | "skirmish" | "loose";
const RESULTS: Result[] = [
  "skirmish",
  "loose",
  "cleared",
  "contained",
  "neededBackup",
];
const SCORE: Record<Result, number> = {
  skirmish: 3,
  loose: 1,
  cleared: 2,
  contained: 1,
  neededBackup: 0,
};

interface Row {
  points: number;
  goal: number;
  pathogens: number;
  med: number;
  results: Record<Result, number>;
  score: number;
  tissueLost: number;
}

const RANK: Record<BattleGrade, number> = {
  cleared: 2,
  contained: 1,
  neededBackup: 0,
};

/**
 * A thoughtful player: the better of the careful line (engulf the mold) and the charge line
 * (leave the mold to the charges) on each battle, so the med level's charges count.
 */
function bestPlay(start: BattleState, seed: number): BattleOutcome {
  const [a, b] = [BOTS.careful, BOTS.saveForCharge].map(
    (bot) => playBattle(bot, start, seed, SUPPORT_BOTS.eager).outcome,
  );
  const key = (o: BattleOutcome) => RANK[o.grade] * 100 + o.tissue.health;
  return key(b) > key(a) ? b : a;
}

function survey(name: string): Row {
  const row: Row = {
    points: 0,
    goal: 0,
    pathogens: 0,
    med: 0,
    results: {
      skirmish: 0,
      loose: 0,
      cleared: 0,
      contained: 0,
      neededBackup: 0,
    },
    score: 0,
    tissueLost: 0,
  };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const life = playWeek(LIFE_BOTS[name], seed);
    row.points += life.goal.points / SEEDS;
    if (life.goal.points >= life.goal.target) row.goal += 1 / SEEDS;
    row.pathogens += life.exposures.length / SEEDS;
    row.med += life.medLevel / SEEDS;
    const kind = battleDue(life).battleKind;
    const outcome = bestPlay(battleFromLoadout(loadoutFromLife(life)), seed);
    const result: Result =
      kind === "skirmish"
        ? outcome.grade === "cleared"
          ? "skirmish"
          : "loose"
        : outcome.grade;
    row.tissueLost += outcome.tissue.lost / SEEDS;
    row.results[result] += 1;
    row.score += SCORE[result] / SEEDS;
  }
  return row;
}

describe("life strategies into battle", () => {
  const rows = Object.fromEntries(
    Object.keys(LIFE_BOTS).map((n) => [n, survey(n)]),
  ) as Record<string, Row>;
  const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(6);
  const share = (r: Row, k: Result) => r.results[k] / SEEDS;

  it("prints the table", () => {
    const lines = [
      "strategy         pts  goal  path   med skirm loose clear  cont  back score tissue",
      ...Object.entries(rows).map(
        ([n, r]) =>
          n.padEnd(15) +
          r.points.toFixed(1).padStart(5) +
          pct(r.goal) +
          r.pathogens.toFixed(2).padStart(6) +
          r.med.toFixed(2).padStart(6) +
          RESULTS.map((k) => pct(share(r, k))).join("") +
          r.score.toFixed(2).padStart(6) +
          r.tissueLost.toFixed(1).padStart(6),
      ),
    ];
    (
      globalThis as unknown as { console: { log(s: string): void } }
    ).console.log(lines.join("\n"));
  });

  it("scores nothing for staying home, which still skirmishes, and the most for every risk", () => {
    expect(rows.home.points).toBe(0);
    expect(rows.home.results.skirmish + rows.home.results.loose).toBe(SEEDS);
    // Skirmishes are easy: the thoughtful player clears nearly all of them.
    expect(share(rows.home, "loose")).toBeLessThan(0.05);
    const best = Math.max(...Object.values(rows).map((r) => r.points));
    expect(rows.risky.points).toBe(best);
    expect(rows.smarter.points).toBeLessThan(rows.risky.points);
    expect(rows.smarter.goal).toBeCloseTo(1, 5);
  });

  it("makes the smarter week clearly better in battle than the risky one", () => {
    expect(rows.smarter.score).toBeGreaterThan(rows.risky.score + 0.3);
    const bad = (r: Row) => share(r, "contained") + share(r, "neededBackup");
    expect(bad(rows.smarter)).toBeLessThan(bad(rows.risky) / 2);
    expect(rows.smarter.tissueLost).toBeLessThan(rows.risky.tissueLost);
    // Honest odds: the risky week often gets away with it.
    expect(share(rows.risky, "skirmish")).toBeGreaterThan(0.2);
  });

  it("makes the risky week suffer the worst battles of the full-meds plays", () => {
    for (const n of ["smarter", "mixed", "bandOnly", "home"]) {
      expect(rows.risky.score, n).toBeLessThan(rows[n].score);
    }
  });

  it("makes skipped doses visibly worsen the same week's battles", () => {
    expect(rows.smarterNoPack.med).toBeCloseTo(2 / 3, 5);
    expect(rows.smarterSkipMeds.med).toBe(0);
    expect(rows.riskyNoPack.score).toBeLessThan(rows.risky.score);
    expect(share(rows.riskyNoPack, "cleared")).toBeLessThan(
      share(rows.risky, "cleared"),
    );
    expect(rows.riskySkipMeds.score).toBeLessThanOrEqual(
      rows.riskyNoPack.score,
    );
    expect(rows.smarterSkipMeds.score).toBeLessThan(rows.smarter.score);
  });

  it("shifts the risky week's battles at each lost charge tier", () => {
    // Full meds kill the staph and the mold with charges; one miss keeps only the antifungal.
    const cleared = (n: string) => share(rows[n], "cleared");
    expect(cleared("riskyNoPack")).toBeLessThan(cleared("risky") - 0.15);
    expect(cleared("riskySkipMeds")).toBeLessThan(
      cleared("riskyNoPack") - 0.15,
    );
  });
});
