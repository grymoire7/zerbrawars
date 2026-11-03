import { describe, expect, it } from "vitest";
import { PARAMS } from "../params";
import { loadScenario } from "../scenarios";
import type { BattleState, Contained, Order } from "../types";
import { validateBattle } from "../validate";
import { BOTS, playBattle } from "./bots";
import { battleStatus, gradeOutcome, reservoirs } from "./outcome";
import { resolveTurn } from "./resolve";

// Duel board: s1 1,6  s2 3,6  s3 5,6; p1 strep (leaky) size 2 at 1,2; p2 aspergillus (sealed)
// size 2 at 5,2.

const MOLD: Contained = { kind: "aspergillus", size: 2 };

function load(seed = 1): BattleState {
  return loadScenario("duel", seed) as BattleState;
}

/** Both pathogens next to a swarm: s1 kills p1, s3 engulfs p2. */
function bothInReach(residualKillChance: number): {
  battle: BattleState;
  orders: Order[];
} {
  const battle = { ...load(), residualKillChance };
  return {
    battle,
    orders: [
      { type: "engulf", swarmId: "s1", pathogenId: "p1", from: { x: 1, y: 3 } },
      { type: "engulf", swarmId: "s3", pathogenId: "p2", from: { x: 5, y: 3 } },
    ],
  };
}

describe("battleStatus", () => {
  it("runs maxTurns turns, then ends", () => {
    let battle = load();
    expect(battleStatus(battle)).toEqual({
      over: false,
      reason: null,
      turnsLeft: PARAMS.maxTurns,
    });
    // Do-nothing play drains tissue to the backup line first, so start the last turns fresh:
    // full tissue on the board, the clock is the only thing that can end it.
    const start = { ...battle, tissueHealth: PARAMS.maxTissueHealth };
    const before = resolveTurn({ ...start, turn: PARAMS.maxTurns - 1 }, []);
    expect(before.status).toEqual({ over: false, reason: null, turnsLeft: 1 });
    battle = resolveTurn({ ...start, turn: PARAMS.maxTurns }, []).state;
    expect(battleStatus(battle)).toEqual({
      over: true,
      reason: "maxTurns",
      turnsLeft: 0,
    });
    // No telegraph for a turn that will not happen, and no more turns.
    expect(battle.intents).toEqual([]);
    expect(() => resolveTurn(battle, [])).toThrow("the battle is over");
  });

  it("ends as soon as no visible pathogen is left; hidden tokens do not count", () => {
    const { battle, orders } = bothInReach(0);
    const r = resolveTurn(battle, orders);
    expect(r.status).toEqual({
      over: true,
      reason: "noFreePathogens",
      turnsLeft: 0,
    });
    expect(r.state.intents).toEqual([]);
    const hiddenOnly: BattleState = {
      ...load(),
      pathogens: load().pathogens.map((p) => ({ ...p, hidden: true })),
    };
    expect(battleStatus(hiddenOnly).reason).toBe("noFreePathogens");
  });
});

describe("backup stop", () => {
  it("ends the battle the moment tissue reaches the backup line", () => {
    const line = PARAMS.outcome.backupTissueHealth;
    const battle = load();
    expect(battleStatus({ ...battle, tissueHealth: line + 1 }).over).toBe(
      false,
    );
    expect(battleStatus({ ...battle, tissueHealth: line })).toEqual({
      over: true,
      reason: "backup",
      turnsLeft: 0,
    });
    // A turn that drains tissue to the line ends the battle there, with no telegraph.
    let r = resolveTurn({ ...battle, tissueHealth: line + 1 }, []);
    for (let i = 0; i < 3 && !r.status.over; i++) r = resolveTurn(r.state, []);
    expect(r.state.tissueHealth).toBeLessThanOrEqual(line);
    expect(r.status.reason).toBe("backup");
    expect(r.state.intents).toEqual([]);
    expect(gradeOutcome(r.state)).toMatchObject({
      grade: "neededBackup",
      turnsPlayed: r.state.turn - 1,
    });
    expect(gradeOutcome(r.state).backupReasons).toContain("tissue");
  });

  it("stops a do-nothing battle early and never lets tissue fall far below the line", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let battle = load(seed);
      while (!battleStatus(battle).over) battle = resolveTurn(battle, []).state;
      expect(battleStatus(battle).reason).toBe("backup");
      expect(battle.turn - 1).toBeLessThan(PARAMS.maxTurns);
      expect(battle.tissueHealth).toBeGreaterThan(0);
    }
  });
});

describe("gradeOutcome", () => {
  it("is cleared when nothing is left", () => {
    const { battle, orders } = bothInReach(1);
    const { state } = resolveTurn(battle, orders);
    expect(gradeOutcome(state)).toEqual({
      grade: "cleared",
      backupReasons: [],
      freePathogens: 0,
      reservoirs: [],
      tissue: {
        health: state.tissueHealth,
        max: PARAMS.maxTissueHealth,
        lost: PARAMS.maxTissueHealth - state.tissueHealth,
      },
      energy: PARAMS.outcome.energy.cleared,
      turnsPlayed: 1,
    });
  });

  it("is contained when a load is left, and lists it as a reservoir", () => {
    const { battle, orders } = bothInReach(0);
    const { state } = resolveTurn(battle, orders);
    const outcome = gradeOutcome(state);
    expect(outcome.grade).toBe("contained");
    expect(outcome.energy).toBe(PARAMS.outcome.energy.contained);
    expect(outcome.reservoirs).toEqual([
      { kind: "aspergillus", size: 2, source: "swarm", sourceId: "s3" },
    ]);
  });

  it("is contained by a granuloma or a hidden token too", () => {
    const empty: BattleState = { ...load(), pathogens: [] };
    expect(gradeOutcome(empty).grade).toBe("cleared");
    const walled: BattleState = {
      ...empty,
      granulomas: [{ id: "g7", at: { x: 0, y: 0 }, contents: [MOLD, MOLD] }],
    };
    expect(gradeOutcome(walled).grade).toBe("contained");
    const hidden: BattleState = {
      ...load(),
      pathogens: [{ ...load().pathogens[1], hidden: true }],
    };
    expect(gradeOutcome(hidden).grade).toBe("contained");
  });

  it("needs backup when free pathogens remain or tissue is too low", () => {
    // Doing nothing: tissue wears down to the backup line before the clock runs out.
    let battle = load();
    while (!battleStatus(battle).over) battle = resolveTurn(battle, []).state;
    const idle = gradeOutcome(battle);
    expect(idle.grade).toBe("neededBackup");
    expect(idle.backupReasons).toContain("freePathogens");
    expect(idle.freePathogens).toBe(
      battle.pathogens.filter((p) => !p.hidden).length,
    );
    expect(idle.energy).toBe(PARAMS.outcome.energy.neededBackup);

    // Out of time with germs still loose is backup too, for that one reason.
    const slow = resolveTurn(
      {
        ...load(),
        tissueHealth: PARAMS.maxTissueHealth,
        turn: PARAMS.maxTurns,
      },
      [],
    );
    expect(slow.status.reason).toBe("maxTurns");
    const late = gradeOutcome(slow.state);
    expect(late.backupReasons).toEqual(["freePathogens"]);
    expect(late.turnsPlayed).toBe(PARAMS.maxTurns);

    const hurt: BattleState = {
      ...load(),
      pathogens: [],
      tissueHealth: PARAMS.outcome.backupTissueHealth,
    };
    expect(gradeOutcome(hurt)).toMatchObject({
      grade: "neededBackup",
      backupReasons: ["tissue"],
    });
    expect(
      gradeOutcome({ ...hurt, tissueHealth: hurt.tissueHealth + 1 }).grade,
    ).toBe("cleared");
  });
});

describe("reservoirs", () => {
  it("lists swarm loads, then granulomas, then hidden tokens", () => {
    const base = load();
    const battle: BattleState = {
      ...base,
      swarms: base.swarms.map((s) =>
        s.id === "s2" ? { ...s, load: [MOLD, { ...MOLD, size: 1 }] } : s,
      ),
      granulomas: [{ id: "g7", at: { x: 0, y: 0 }, contents: [MOLD] }],
      pathogens: [{ ...base.pathogens[1], hidden: true }],
    };
    expect(reservoirs(battle)).toEqual([
      { kind: "aspergillus", size: 2, source: "swarm", sourceId: "s2" },
      { kind: "aspergillus", size: 1, source: "swarm", sourceId: "s2" },
      { kind: "aspergillus", size: 2, source: "granuloma", sourceId: "g7" },
      { kind: "aspergillus", size: 2, source: "hidden", sourceId: "p2" },
    ]);
  });
});

describe("whole battles", () => {
  it("are deterministic, JSON-safe and valid after every turn", () => {
    for (const name of Object.keys(BOTS)) {
      for (const seed of [1, 2, 3]) {
        const start = loadScenario("first-board", seed) as BattleState;
        const a = playBattle(BOTS[name], start, seed);
        expect(playBattle(BOTS[name], start, seed)).toEqual(a);
        expect(JSON.parse(JSON.stringify(a))).toEqual(a);
        expect(validateBattle(a.final)).toEqual([]);
        expect(battleStatus(a.final).over).toBe(true);
      }
    }
  });

  it("resolve the same from a JSON copy mid-battle, wall-offs included", () => {
    let battle = {
      ...(loadScenario("first-board", 5) as BattleState),
      residualKillChance: 0,
    };
    const script: Order[][] = [
      [
        {
          type: "engulf",
          swarmId: "s1",
          pathogenId: "p1",
          from: { x: 1, y: 3 },
        },
        {
          type: "engulf",
          swarmId: "s3",
          pathogenId: "p2",
          from: { x: 5, y: 3 },
        },
      ],
      [{ type: "wallOff", swarmId: "s3" }],
    ];
    for (const orders of script) {
      const copy = JSON.parse(JSON.stringify(battle)) as BattleState;
      const r = resolveTurn(battle, orders);
      expect(resolveTurn(copy, orders)).toEqual(r);
      expect(JSON.parse(JSON.stringify(r))).toEqual(r);
      expect(validateBattle(r.state)).toEqual([]);
      battle = r.state;
    }
    expect(battle.granulomas).toHaveLength(1);
  });
});

describe("validateBattle T7 rules", () => {
  it("lets a swarm share its granuloma's tile but nothing else overlap one", () => {
    const base = load();
    const g = { id: "g7", at: base.swarms[0].at, contents: [MOLD] };
    expect(validateBattle({ ...base, granulomas: [g] })).toEqual([]);
    const onPathogen = { ...g, at: base.pathogens[0].at };
    expect(validateBattle({ ...base, granulomas: [onPathogen] })).toEqual([
      "p1 overlaps g7 at 1,2",
    ]);
    expect(
      validateBattle({ ...base, granulomas: [{ ...g, contents: [] }] }),
    ).toEqual(["g7 is empty"]);
  });

  it("flags bad inflammation and tissue health", () => {
    const base = load();
    const tiles = [...base.board.tiles];
    tiles[0] = { inflammation: PARAMS.maxInflammation + 1 };
    expect(
      validateBattle({
        ...base,
        board: { ...base.board, tiles },
        tissueHealth: -1,
      }),
    ).toEqual([
      `tile 0 has invalid inflammation ${PARAMS.maxInflammation + 1}`,
      "invalid tissue health -1",
    ]);
  });
});
