import { describe, expect, it } from "vitest";
import { sameCoord } from "../board";
import { duelLoadout } from "../scenarios";
import { fullWaves, skirmishWaves } from "../life/loadout";
import { PARAMS } from "../params";
import type { Arrival, BattleState, Coord, SimEvent } from "../types";
import { validateBattle } from "../validate";
import { BOTS, playBattle } from "./bots";
import { generateIntents, telegraph } from "./intents";
import { battleStatus } from "./outcome";
import { battleFromLoadout } from "./setup";
import { resolveTurn } from "./resolve";

// Duel board: s1 1,6  s2 3,6  s3 5,6; strep p1 size 2 at 1,2; mold p2 size 2 at 5,2.

const DOOR: Coord = { x: 3, y: 0 };
const strep = (turn: number, door: Coord = DOOR): Arrival => ({
  turn,
  kind: "strep",
  size: 1,
  door,
});

function withArrivals(arrivals: Arrival[], seed = 1): BattleState {
  return battleFromLoadout({ ...duelLoadout(seed), arrivals });
}

/** The same battle on turn `turn` (arrivals due then), a swarm optionally standing on `at`. */
function atTurn(b: BattleState, turn: number, swarmAt?: Coord): BattleState {
  const swarms = swarmAt
    ? b.swarms.map((s) => (s.id === "s2" ? { ...s, at: swarmAt } : s))
    : b.swarms;
  return generateIntents({ ...b, turn, swarms });
}

const types = (events: readonly SimEvent[]) => events.map((e) => e.type);

describe("the schedule", () => {
  it("is carried into the battle in turn order, and validated", () => {
    const b = withArrivals([strep(4), strep(3, { x: 1, y: 0 })]);
    expect(b.arrivals.map((a) => a.turn)).toEqual([3, 4]);
    expect(validateBattle(b)).toEqual([]);
    expect(validateBattle({ ...b, arrivals: [strep(3), strep(3)] })).toEqual([
      expect.stringContaining("two arrivals"),
    ]);
    expect(
      validateBattle({ ...b, arrivals: [strep(3, { x: 9, y: 0 })] }),
    ).toEqual([expect.stringContaining("out of bounds")]);
    expect(
      validateBattle({
        ...b,
        arrivals: [{ ...strep(3), kind: "strep", size: 9 }],
      }),
    ).toEqual([expect.stringContaining("invalid size")]);
  });

  it("splits a skirmish: skirmishFirst on the board, the rest at their own tile later", () => {
    const threats = [
      { kind: "strep" as const, size: 1, at: { x: 1, y: 0 } },
      { kind: "strep" as const, size: 1, at: { x: 5, y: 0 } },
      { kind: "strep" as const, size: 1, at: { x: 3, y: 1 } },
    ];
    const w = skirmishWaves(threats);
    expect(w.exposures).toEqual(threats.slice(0, PARAMS.waves.skirmishFirst));
    expect(w.arrivals).toEqual(
      threats.slice(PARAMS.waves.skirmishFirst).map((t) => ({
        turn: 1 + PARAMS.waves.skirmishDelay,
        kind: "strep",
        size: 1,
        door: t.at,
      })),
    );
  });

  it("gives a full battle smaller second groups on doors no exposure starts on", () => {
    const exposures = [
      { kind: "strep" as const, size: 2, at: { x: 1, y: 0 } },
      { kind: "aspergillus" as const, size: 1, at: { x: 5, y: 0 } },
    ];
    const arrivals = fullWaves(exposures);
    expect(arrivals).toHaveLength(
      Math.min(exposures.length, PARAMS.waves.maxSecondGroups),
    );
    arrivals.forEach((a, i) => {
      expect(a.turn).toBe(1 + PARAMS.waves.delay);
      expect(a.kind).toBe(exposures[i].kind);
      expect(a.size).toBe(
        Math.max(1, exposures[i].size - PARAMS.waves.sizeDrop),
      );
      expect(PARAMS.setup.doors.some((d) => sameCoord(d, a.door))).toBe(true);
      expect(exposures.some((e) => sameCoord(e.at, a.door))).toBe(false);
    });
    expect(new Set(arrivals.map((a) => `${a.door.x},${a.door.y}`)).size).toBe(
      arrivals.length,
    );
  });
});

describe("the telegraph", () => {
  it("marks an arrival due this turn at its door, and nothing for later ones", () => {
    const b = atTurn(withArrivals([strep(3), strep(5, { x: 1, y: 0 })]), 3);
    const marks = telegraph(b).filter((m) => m.type === "arrive");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toMatchObject({
      type: "arrive",
      kind: "strep",
      from: DOOR,
      to: DOOR,
      sizeAfter: 1,
      childSize: 1,
      blockedBy: null,
      cancelledBy: null,
    });
    expect(
      telegraph(atTurn(withArrivals([strep(3)]), 2)).some(
        (m) => m.type === "arrive",
      ),
    ).toBe(false);
  });

  it("shows a swarm on the door as the blocker, with the orders as they will stand", () => {
    const b = atTurn(withArrivals([strep(3)]), 3, DOOR);
    expect(telegraph(b).find((m) => m.type === "arrive")?.blockedBy).toBe("s2");
  });

  it("keeps spreads and spores off a door due this turn or the next", () => {
    for (let seed = 1; seed <= 100; seed++) {
      const b = atTurn(withArrivals([strep(3)], seed), 2);
      for (const i of b.intents)
        if (i.type === "spread" || i.type === "spore")
          expect(sameCoord(i.to, DOOR)).toBe(false);
    }
  });
});

describe("landing", () => {
  it("lands the group in the intents phase with a new pathogen id", () => {
    const b = atTurn(withArrivals([strep(3)]), 3);
    const r = resolveTurn(b, []);
    const p = r.state.pathogens.find((q) => sameCoord(q.at, DOOR));
    expect(p).toMatchObject({ kind: "strep", size: 1, hidden: false });
    expect(r.events).toContainEqual({
      type: "Arrived",
      pathogenId: p?.id,
      kind: "strep",
      size: 1,
      at: DOOR,
    });
    expect(r.state.arrivals).toEqual([]);
    expect(validateBattle(r.state)).toEqual([]);
  });

  it("is killed by a swarm standing on the door when it is leaky", () => {
    const b = atTurn(withArrivals([strep(3)]), 3, DOOR);
    const r = resolveTurn(b, []);
    expect(r.events).toContainEqual({
      type: "ArrivalBlocked",
      kind: "strep",
      size: 1,
      at: DOOR,
      swarmId: "s2",
      fate: "died",
    });
    expect(r.state.pathogens.some((q) => sameCoord(q.at, DOOR))).toBe(false);
    expect(r.state.arrivals).toEqual([]);
  });

  it("comes back next turn at the nearest free door when it is sealed", () => {
    const staph: Arrival = { turn: 3, kind: "staph", size: 2, door: DOOR };
    const b = atTurn(withArrivals([staph]), 3, DOOR);
    const r = resolveTurn(b, []);
    expect(r.events.find((e) => e.type === "ArrivalBlocked")).toMatchObject({
      fate: "delayed",
      swarmId: "s2",
    });
    expect(r.state.arrivals).toHaveLength(1);
    const back = r.state.arrivals[0];
    expect(back).toMatchObject({ turn: 4, kind: "staph", size: 2 });
    expect(sameCoord(back.door, DOOR)).toBe(false);
    expect(PARAMS.setup.doors.some((d) => sameCoord(d, back.door))).toBe(true);
    expect(validateBattle(r.state)).toEqual([]);
    // Nothing at the old door, and the mark moves with it.
    expect(telegraph(r.state).find((m) => m.type === "arrive")?.from).toEqual(
      back.door,
    );
  });

  it("tries again next turn when something else sits on the door", () => {
    const b = atTurn(withArrivals([strep(3, { x: 5, y: 2 })]), 3);
    const r = resolveTurn(b, []);
    expect(types(r.events)).toContain("ArrivalBlocked");
    expect(r.state.arrivals[0].turn).toBe(4);
  });
});

describe("the battle stays open", () => {
  it("is not over while an arrival is pending, even with the board clear", () => {
    const b = withArrivals([strep(3)]);
    const orders = [
      {
        type: "engulf" as const,
        swarmId: "s1",
        pathogenId: "p1",
        from: { x: 1, y: 3 },
      },
    ];
    // Clear the board by hand: the mold is killed by a charge-free shortcut (state edit).
    const cleared: BattleState = {
      ...b,
      pathogens: b.pathogens.filter((p) => p.id === "p1"),
      intents: [],
    };
    const r = resolveTurn(generateIntents(cleared), orders);
    expect(r.state.pathogens).toEqual([]);
    expect(r.status.over).toBe(false);
    const r2 = resolveTurn(r.state, []);
    expect(r2.status.over).toBe(false);
    // Turn 3: it lands, so the board is not clear; a swarm there ends it on turn 4.
    const r3 = resolveTurn(r2.state, []);
    expect(r3.state.pathogens).toHaveLength(1);
    expect(battleStatus(r3.state).over).toBe(false);
  });

  it("is over at the clock whatever is still due", () => {
    const b = withArrivals([strep(PARAMS.maxTurns + 2)]);
    expect(battleStatus({ ...b, turn: PARAMS.maxTurns + 1 })).toMatchObject({
      over: true,
      reason: "maxTurns",
    });
  });
});

describe("determinism", () => {
  it("plays the same arrivals the same way", () => {
    const run = () =>
      playBattle(
        BOTS.careful,
        withArrivals([strep(3), strep(4, { x: 1, y: 0 })], 5),
        5,
      );
    expect(run()).toEqual(run());
    expect(validateBattle(run().final)).toEqual([]);
  });
});
