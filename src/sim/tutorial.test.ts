import { describe, expect, it } from "vitest";
import { BOTS, playBattle, SUPPORT_BOTS } from "./battle/bots";
import { resolveTurn } from "./battle/resolve";
import { battleFromLoadout } from "./battle/setup";
import { battleStatus } from "./battle/outcome";
import { PARAMS } from "./params";
import {
  loadScenario,
  TUTORIAL_SEED,
  tutorialALoadout,
  tutorialBLoadout,
} from "./scenarios";
import type { BattleOutcome, BattleState, Order } from "./types";
import { validateBattle } from "./validate";

// Arc 1's two fights (design: docs/specs/arc1-tutorial-design.md, sections 3.2, 3.3 and 8). Part
// A is before the diagnosis (no medication, three turns), part B after it (full medication), on
// the same board and seed. Bot tables: `npx vitest run src/sim/tutorial.test.ts --silent=false`.

const RESIDUALS = {
  xl: PARAMS.residualByVariant.xl,
  ar: PARAMS.residualByVariant.ar,
};
const A = () => loadScenario("tutorial-a", TUTORIAL_SEED) as BattleState;
const B = () => loadScenario("tutorial-b", TUTORIAL_SEED) as BattleState;
/** Part B as a variant plays it: the loadout carries the variant's residual chance. */
const bFor = (residual: number) =>
  battleFromLoadout({
    ...tutorialBLoadout(TUTORIAL_SEED),
    residualKillChance: residual,
  });
const intentOf = (b: BattleState, id: string) =>
  b.intents.find((i) => i.pathogenId === id)?.type;
const unfinished = (o: BattleOutcome) =>
  o.freePathogens > 0 || o.reservoirs.length > 0;
/** Bots that make choices, plus the random baseline run over many bot seeds. */
const PLAYERS = Object.keys(BOTS).filter((n) => n !== "hold" && n !== "random");
const RANDOM_RUNS = 100;

describe("the scenarios", () => {
  it("validate, and differ only in medication, residual chance and clock", () => {
    for (const b of [A(), B()]) expect(validateBattle(b)).toEqual([]);
    expect(A()).toMatchObject({
      kind: "full",
      maxTurns: 3,
      residualKillChance: 0,
    });
    expect(A().meds).toMatchObject({
      level: 0,
      aura: 0,
      charges: { antibacterial: 0, antifungal: 0, strong: 0 },
    });
    expect(B()).toMatchObject({ kind: "full", maxTurns: PARAMS.maxTurns });
    expect(B().meds).toMatchObject({
      level: 1,
      charges: { antibacterial: 1, antifungal: 2 },
    });
    const same = (b: BattleState) => ({
      swarms: b.swarms,
      pathogens: b.pathogens,
      arrivals: b.arrivals,
      rng: b.rng,
    });
    expect(same(B())).toEqual(same(A()));
  });

  it("lets a loadout shorten the clock but not stretch it", () => {
    const l = tutorialALoadout(1);
    expect(battleFromLoadout({ ...l, maxTurns: 1 }).maxTurns).toBe(1);
    const b = battleFromLoadout(l);
    expect(validateBattle({ ...b, maxTurns: PARAMS.maxTurns + 1 })).toEqual([
      expect.stringContaining("turns"),
    ]);
    expect(validateBattle({ ...b, maxTurns: 0 })).toEqual([
      expect.stringContaining("turns"),
    ]);
  });

  it("ends the fight on the clock: over after the third resolve with a germ left", () => {
    let b = A();
    for (let t = 1; t <= 3; t++) {
      expect(battleStatus(b).over).toBe(false);
      b = resolveTurn(b, [], null).state;
    }
    expect(battleStatus(b)).toMatchObject({ over: true, reason: "maxTurns" });
  });
});

describe("the pinned seed", () => {
  it("shows the mold growing in A and stalled in B on turn 1", () => {
    expect(intentOf(A(), "p1")).toBe("grow");
    expect(intentOf(B(), "p1")).toBe("stall");
  });

  it("telegraphs a spore from the size 3 mold on turn 2 of A, whatever the swarms did", () => {
    const orderSets: Order[][] = [
      [],
      // s1 steps next to the strep and engulfs it, the others walk up.
      [
        {
          type: "engulf",
          swarmId: "s1",
          pathogenId: "p2",
          from: { x: 1, y: 4 },
        },
        { type: "move", swarmId: "s2", to: { x: 3, y: 3 } },
        { type: "move", swarmId: "s3", to: { x: 5, y: 3 } },
      ],
    ];
    for (const orders of orderSets) {
      const next = resolveTurn(A(), orders, null).state;
      expect(next.turn).toBe(2);
      expect(next.pathogens.find((p) => p.id === "p1")?.size).toBe(3);
      expect(intentOf(next, "p1")).toBe("spore");
    }
  });
});

describe("part A, before the diagnosis", () => {
  it("leaves a do-nothing player at 12 or more tissue with the infection unfinished", () => {
    const { outcome, final } = playBattle(BOTS.hold, A(), 1);
    expect(outcome.tissue.health).toBeGreaterThanOrEqual(12);
    expect(battleStatus(final).reason).toBe("maxTurns");
    expect(unfinished(outcome)).toBe(true);
  });

  it("never finishes the mold for any play: every bot and many random plays", () => {
    const runs = [
      ...Object.keys(BOTS)
        .filter((n) => n !== "random")
        .map((n) => [BOTS[n], 1] as const),
      ...Array.from(
        { length: RANDOM_RUNS },
        (_, i) => [BOTS.random, i + 1] as const,
      ),
    ];
    let lowest: number = PARAMS.maxTissueHealth;
    for (const [bot, seed] of runs) {
      const { outcome, final } = playBattle(bot, A(), seed, SUPPORT_BOTS.eager);
      expect(validateBattle(final)).toEqual([]);
      expect(unfinished(outcome)).toBe(true);
      // The mold is somewhere: on the board, inside a swarm or walled off.
      expect(
        final.pathogens.some((p) => p.kind === "aspergillus") ||
          final.swarms.some((s) =>
            s.load.some((c) => c.kind === "aspergillus"),
          ) ||
          final.granulomas.some((g) =>
            g.contents.some((c) => c.kind === "aspergillus"),
          ),
      ).toBe(true);
      lowest = Math.min(lowest, outcome.tissue.health);
    }
    // Careful play strains the tissue a little; only random play ever nears the backup line.
    const careful = playBattle(BOTS.careful, A(), 1).outcome.tissue.health;
    expect(careful).toBeGreaterThanOrEqual(12);
    expect(careful).toBeLessThan(PARAMS.maxTissueHealth);
    log(`A: lowest tissue over all runs ${lowest}, careful ${careful}`);
  });

  it("would let a lucky roll clear the mold if the residual chance were the variant's", () => {
    // Why tutorial-a fixes the residual chance at 0: with the variant's, a clear is possible.
    const rates: Record<string, string> = {};
    for (const [v, residual] of Object.entries(RESIDUALS)) {
      const plays = [
        ...PLAYERS.map((n) => [BOTS[n], 1] as const),
        ...Array.from({ length: 300 }, (_, i) => [BOTS.random, i + 1] as const),
      ];
      const cleared = plays.filter(([bot, seed]) => {
        const start = battleFromLoadout({
          ...tutorialALoadout(TUTORIAL_SEED),
          residualKillChance: residual,
        });
        return !unfinished(
          playBattle(bot, start, seed, SUPPORT_BOTS.eager).outcome,
        );
      }).length;
      rates[v] = `${cleared}/${plays.length}`;
    }
    log(`A without the override, cleared: ${JSON.stringify(rates)}`);
    expect(Object.keys(rates)).toHaveLength(2);
  });
});

describe.each(Object.entries(RESIDUALS))(
  "part B, after the diagnosis (%s)",
  (_v, residual) => {
    it("clears the board for careful play, whichever way the charges are spent", () => {
      for (const name of [
        "careful",
        "saveForCharge",
        "engulfAll",
        "sealedFirst",
      ]) {
        const { outcome, final } = playBattle(
          BOTS[name],
          bFor(residual),
          1,
          SUPPORT_BOTS.eager,
        );
        expect(validateBattle(final)).toEqual([]);
        expect(outcome.grade, name).toBe("cleared");
      }
    });

    it("clears for 85% or more of varied plays, and never needs backup", () => {
      const rows: string[] = [];
      const grades = { cleared: 0, contained: 0, neededBackup: 0 };
      let total = 0;
      const runs = [
        ...PLAYERS.map((n) => [n, BOTS[n], 1] as const),
        ...Array.from(
          { length: RANDOM_RUNS },
          (_, i) => ["random", BOTS.random, i + 1] as const,
        ),
      ];
      for (const [, bot, seed] of runs) {
        const { outcome } = playBattle(
          bot,
          bFor(residual),
          seed,
          SUPPORT_BOTS.eager,
        );
        grades[outcome.grade]++;
        total++;
      }
      rows.push(`B ${_v}: ${total} plays ${JSON.stringify(grades)}`);
      log(rows.join("\n"));
      expect(grades.cleared / total).toBeGreaterThanOrEqual(0.85);
      expect(grades.neededBackup).toBe(0);
    });
  },
);

/** The sim's tsconfig has no DOM or Node types, so reach console through globalThis. */
function log(s: string): void {
  (globalThis as unknown as { console: { log(s: string): void } }).console.log(
    s,
  );
}
