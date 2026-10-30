import { describe, expect, it } from "vitest";
import { sameCoord } from "../board";
import { rngFromSeed, rngInt, rngNext, type RngState } from "../rng";
import { loadScenario } from "../scenarios";
import type {
  BattleState,
  Contained,
  Coord,
  Intent,
  Order,
  SimEvent,
  Swarm,
} from "../types";
import { validateBattle } from "../validate";
import { telegraph } from "./intents";
import { battleStatus } from "./outcome";
import {
  engulfPreview,
  engulfTargets,
  moveOptions,
  moveRange,
  orderProblems,
  validateOrders,
  withOrder,
} from "./orders";
import { resolveTurn } from "./resolve";

// Duel board: s1 1,6  s2 3,6  s3 5,6; p1 strep (leaky) size 2 at 1,2; p2 aspergillus (sealed)
// size 2 at 5,2.

function load(seed = 1, residualKillChance?: number): BattleState {
  const b = loadScenario("duel", seed) as BattleState;
  return residualKillChance === undefined ? b : { ...b, residualKillChance };
}

const engulf = (
  swarmId: string,
  pathogenId: string,
  from: Coord | null,
): Extract<Order, { type: "engulf" }> => ({
  type: "engulf",
  swarmId,
  pathogenId,
  from,
});

const MOLD: Contained = { kind: "aspergillus", size: 1 };

const withSwarm = (
  battle: BattleState,
  id: string,
  patch: Partial<Swarm>,
): BattleState => ({
  ...battle,
  swarms: battle.swarms.map((s) => (s.id === id ? { ...s, ...patch } : s)),
});

/** Event types without the end-of-turn inflammation tick. */
const acts = (events: readonly SimEvent[]) =>
  events
    .map((e) => e.type)
    .filter((t) => t !== "InflammationChanged" && t !== "TissueDamaged");

const reasons = (battle: BattleState, orders: Order[]) =>
  validateOrders(battle, orders).map((c) => c.reason);

/** p1 spreads to 0,2; p2 spores to 2,2. */
function threatening(residual = 0): BattleState {
  const intents: Intent[] = [
    { type: "spread", pathogenId: "p1", to: { x: 0, y: 2 }, size: 1, cost: 0 },
    {
      type: "spore",
      pathogenId: "p2",
      to: { x: 2, y: 2 },
      size: 1,
      cost: 1,
    },
  ];
  const base = load(1, residual);
  return {
    ...base,
    pathogens: base.pathogens.map((p) =>
      p.id === "p2" ? { ...p, size: 3 } : p,
    ),
    intents,
  };
}

describe("engulf resolution", () => {
  it("kills a leaky pathogen outright after the from move, whatever its size", () => {
    const base = load();
    const battle: BattleState = {
      ...base,
      pathogens: base.pathogens.map((p) =>
        p.id === "p1" ? { ...p, size: 4 } : p,
      ),
    };
    const { state, events } = resolveTurn(battle, [
      engulf("s1", "p1", { x: 1, y: 3 }),
    ]);
    expect(events.slice(0, 3)).toEqual([
      {
        type: "SwarmMoved",
        swarmId: "s1",
        path: [
          { x: 1, y: 6 },
          { x: 1, y: 5 },
          { x: 1, y: 4 },
          { x: 1, y: 3 },
        ],
      },
      { type: "Engulfed", swarmId: "s1", pathogenId: "p1", wall: "leaky" },
      { type: "Killed", pathogenId: "p1", at: { x: 1, y: 2 }, cause: "engulf" },
    ]);
    expect(events.some((e) => e.type === "ResidualKill")).toBe(false);
    expect(state.pathogens.map((p) => p.id)).toEqual(["p2"]);
    expect(state.swarms[0]).toMatchObject({ at: { x: 1, y: 3 }, load: [] });
    expect(state.rng.resolution).toEqual(battle.rng.resolution);
    expect(validateBattle(state)).toEqual([]);
  });

  it("loads a sealed pathogen at 0% residual and slows the swarm", () => {
    const battle = load(1, 0);
    const { state, events } = resolveTurn(battle, [
      engulf("s3", "p2", { x: 5, y: 3 }),
    ]);
    expect(events.slice(1, 4)).toEqual([
      { type: "Engulfed", swarmId: "s3", pathogenId: "p2", wall: "sealed" },
      { type: "ResidualKill", swarmId: "s3", chance: 0, success: false },
      {
        type: "Loaded",
        swarmId: "s3",
        load: [{ kind: "aspergillus", size: 2 }],
      },
    ]);
    const s3 = state.swarms[2];
    expect(s3.load).toEqual([{ kind: "aspergillus", size: 2 }]);
    expect(moveRange(s3)).toBe(2);
    expect(state.pathogens.map((p) => p.id)).not.toContain("p2");
    // The roll is always made, so the stream moves even at 0%.
    expect(state.rng.resolution).toEqual(rngNext(battle.rng.resolution).rng);
    expect(validateBattle(state)).toEqual([]);
  });

  it("kills a sealed pathogen at 100% residual", () => {
    const { state, events } = resolveTurn(load(1, 1), [
      engulf("s3", "p2", { x: 5, y: 3 }),
    ]);
    expect(events.slice(1, 4)).toEqual([
      { type: "Engulfed", swarmId: "s3", pathogenId: "p2", wall: "sealed" },
      { type: "ResidualKill", swarmId: "s3", chance: 1, success: true },
      { type: "Killed", pathogenId: "p2", at: { x: 5, y: 2 }, cause: "engulf" },
    ]);
    expect(state.swarms[2].load).toEqual([]);
    expect(events.some((e) => e.type === "Loaded")).toBe(false);
  });

  it("rolls a mid chance from the resolution stream, deterministically per seed", () => {
    const outcomes = new Set<boolean>();
    for (let seed = 1; seed <= 200; seed++) {
      const battle = load(seed, 0.5);
      const orders = [engulf("s3", "p2", { x: 5, y: 3 })];
      const result = resolveTurn(battle, orders);
      expect(resolveTurn(battle, orders)).toEqual(result);
      const roll = result.events.find((e) => e.type === "ResidualKill");
      const expected = rngNext(battle.rng.resolution).value < 0.5;
      expect(roll).toMatchObject({ chance: 0.5, success: expected });
      expect(result.state.swarms[2].load).toHaveLength(expected ? 0 : 1);
      outcomes.add(expected);
      // The roll never touches enemy behaviour: the next telegraph is the same at any chance.
      for (const chance of [0, 1]) {
        const other = resolveTurn(
          { ...battle, residualKillChance: chance },
          orders,
        );
        expect(other.state.intents).toEqual(result.state.intents);
        expect(other.state.rng.intents).toEqual(result.state.rng.intents);
      }
    }
    expect([...outcomes].sort()).toEqual([false, true]);
  });

  it("resolves engulfs in swarm order, one roll each", () => {
    const base = load(1, 0);
    const battle: BattleState = {
      ...base,
      pathogens: [
        ...base.pathogens,
        {
          id: "p3",
          kind: "aspergillus",
          size: 1,
          at: { x: 3, y: 5 },
          hidden: false,
        },
      ],
      intents: [],
    };
    const { state, events } = resolveTurn(battle, [
      engulf("s3", "p2", { x: 5, y: 3 }),
      engulf("s2", "p3", null),
    ]);
    expect(
      events.filter((e) => e.type === "Engulfed").map((e) => e.swarmId),
    ).toEqual(["s2", "s3"]);
    expect(state.rng.resolution).toEqual(
      rngNext(rngNext(battle.rng.resolution).rng).rng,
    );
  });

  it("cancels the engulfed pathogen's intent, in the preview and at resolve", () => {
    const battle = threatening();
    const orders = [
      engulf("s1", "p1", { x: 1, y: 3 }),
      engulf("s3", "p2", { x: 5, y: 3 }),
    ];
    expect(telegraph(battle).map((m) => m.cancelledBy)).toEqual([null, null]);
    expect(telegraph(battle, orders).map((m) => m.cancelledBy)).toEqual([
      "s1",
      "s3",
    ]);
    // A partial order set cancels only its own target.
    expect(
      telegraph(battle, orders.slice(0, 1)).map((m) => m.cancelledBy),
    ).toEqual(["s1", null]);
    const { state, events } = resolveTurn(battle, orders);
    expect(events.some((e) => e.type === "Spread" || e.type === "Spored")).toBe(
      false,
    );
    expect(state.pathogens).toEqual([]);
    expect(state.nextId).toBe(battle.nextId);
    // Without the engulfs both actions land.
    expect(acts(resolveTurn(battle, []).events)).toEqual(["Spread", "Spored"]);
  });

  it("keeps other pathogens' intents running", () => {
    const battle = threatening();
    const { events } = resolveTurn(battle, [
      engulf("s1", "p1", { x: 1, y: 3 }),
    ]);
    expect(acts(events)).toEqual([
      "SwarmMoved",
      "Engulfed",
      "Killed",
      "Spored",
    ]);
  });
});

describe("engulf validation", () => {
  it("accepts in-place and treats from = own tile as in place", () => {
    const battle = withSwarm(load(), "s1", { at: { x: 1, y: 3 } });
    expect(reasons(battle, [engulf("s1", "p1", null)])).toEqual([null]);
    const [check] = validateOrders(battle, [
      engulf("s1", "p1", { x: 1, y: 3 }),
    ]);
    expect(check).toMatchObject({ reason: null, path: null });
    const { events } = resolveTurn(battle, [engulf("s1", "p1", null)]);
    expect(events[0].type).toBe("Engulfed");
  });

  it("rejects non-adjacent targets, bad from moves, hidden and missing pathogens, busy swarms", () => {
    const base = load();
    const battle: BattleState = {
      ...withSwarm(base, "s2", { busyTurns: 1 }),
      pathogens: [
        ...base.pathogens,
        { id: "p9", kind: "strep", size: 1, at: { x: 3, y: 5 }, hidden: true },
      ],
    };
    expect(
      reasons(battle, [
        engulf("s1", "p1", null),
        engulf("s3", "p2", { x: 5, y: 2 }),
      ]),
    ).toEqual(["p1 is not next to 1,6", "5,2 is blocked"]);
    expect(reasons(battle, [engulf("s1", "p1", { x: 0, y: 2 })])).toEqual([
      "0,2 is 5 steps away, max 3",
    ]);
    expect(reasons(battle, [engulf("s1", "p1", { x: 1, y: 4 })])).toEqual([
      "p1 is not next to 1,4",
    ]);
    expect(reasons(battle, [engulf("s1", "p9", null)])).toEqual([
      "no pathogen p9",
    ]);
    expect(reasons(battle, [engulf("s1", "p7", null)])).toEqual([
      "no pathogen p7",
    ]);
    expect(reasons(battle, [engulf("s2", "p1", null)])).toEqual(["s2 is busy"]);
  });

  it("gives a target to the earlier engulf only, and a from tile counts as a destination", () => {
    const battle = withSwarm(load(), "s2", { at: { x: 2, y: 4 } });
    expect(
      reasons(battle, [
        engulf("s1", "p1", { x: 1, y: 3 }),
        engulf("s2", "p1", { x: 2, y: 2 }),
      ]),
    ).toEqual([null, "s1 is already engulfing p1"]);
    expect(
      reasons(battle, [
        engulf("s1", "p1", { x: 1, y: 3 }),
        { type: "move", swarmId: "s2", to: { x: 1, y: 3 } },
      ]),
    ).toEqual([null, "s1 is already moving to 1,3"]);
    // One engulf per swarm.
    expect(
      reasons(battle, [
        engulf("s2", "p1", { x: 2, y: 2 }),
        engulf("s2", "p1", null),
      ]),
    ).toEqual([null, "two orders for s2"]);
  });

  it("refuses a sealed engulf at the load cap but still allows a leaky one", () => {
    const battle = withSwarm(
      withSwarm(load(), "s3", { at: { x: 5, y: 3 }, load: [MOLD, MOLD] }),
      "s1",
      { at: { x: 1, y: 4 }, load: [MOLD, MOLD] },
    );
    expect(reasons(battle, [engulf("s3", "p2", null)])).toEqual([
      "s3 is full (2/2)",
    ]);
    expect(engulfTargets(battle, "s3")).toEqual([]);
    const { state, events } = resolveTurn(battle, [
      engulf("s1", "p1", { x: 1, y: 3 }),
    ]);
    expect(events.map((e) => e.type).slice(0, 3)).toEqual([
      "SwarmMoved",
      "Engulfed",
      "Killed",
    ]);
    expect(state.swarms[0].load).toHaveLength(2);
  });

  it("leaves the state unchanged when any order is rejected", () => {
    const battle = load();
    const before = JSON.parse(JSON.stringify(battle)) as BattleState;
    const orders = [
      engulf("s3", "p2", { x: 5, y: 3 }),
      engulf("s1", "p2", null),
    ];
    expect(orderProblems(battle, orders)).toEqual([
      "s3 is already engulfing p2",
    ]);
    expect(() => resolveTurn(battle, orders)).toThrow(
      "invalid orders: s3 is already engulfing p2",
    );
    expect(battle).toEqual(before);
  });
});

describe("load slows the swarm", () => {
  it("drops move range by one per contained pathogen, never below 1, and 0 while busy", () => {
    const s = load().swarms[0];
    expect(moveRange(s)).toBe(3);
    expect(moveRange({ ...s, load: [MOLD] })).toBe(2);
    expect(moveRange({ ...s, load: [MOLD, MOLD] })).toBe(1);
    expect(moveRange({ ...s, load: [MOLD, MOLD, MOLD, MOLD] })).toBe(1);
    expect(moveRange({ ...s, load: [MOLD], busyTurns: 1 })).toBe(0);
  });

  it("limits moves, move options and engulf approaches", () => {
    const battle = withSwarm(load(), "s1", { load: [MOLD] });
    expect(Math.max(...moveOptions(battle, "s1").map((r) => r.steps))).toBe(2);
    expect(
      reasons(battle, [{ type: "move", swarmId: "s1", to: { x: 1, y: 3 } }]),
    ).toEqual(["1,3 is 3 steps away, max 2"]);
    expect(engulfTargets(battle, "s1")).toEqual([]);
  });

  it("applies the turn after loading", () => {
    const battle = load(1, 0);
    const { state } = resolveTurn(battle, [engulf("s3", "p2", { x: 5, y: 3 })]);
    expect(
      reasons(state, [{ type: "move", swarmId: "s3", to: { x: 5, y: 6 } }]),
    ).toEqual(["5,6 is 3 steps away, max 2"]);
  });
});

describe("engulfTargets and engulfPreview", () => {
  it("lists reachable targets with the nearest from tile", () => {
    const battle = load();
    expect(engulfTargets(battle, "s1")).toEqual([
      {
        pathogenId: "p1",
        wall: "leaky",
        outcome: "kills",
        from: { x: 1, y: 3 },
        froms: [{ x: 1, y: 3 }],
      },
    ]);
    expect(engulfTargets(battle, "s2")).toEqual([]);
    expect(engulfTargets(battle, "s3")).toMatchObject([
      {
        pathogenId: "p2",
        wall: "sealed",
        outcome: "residualRoll",
        from: { x: 5, y: 3 },
      },
    ]);
    const near = withSwarm(battle, "s1", { at: { x: 1, y: 3 } });
    const [t] = engulfTargets(near, "s1");
    expect(t.from).toBeNull();
    expect(t.froms[0]).toBeNull();
    expect(t.froms).toContainEqual({ x: 2, y: 2 });
    for (const from of t.froms) {
      expect(reasons(near, [engulf("s1", "p1", from)])).toEqual([null]);
    }
  });

  it("hides targets and tiles taken by other swarms' pending orders", () => {
    const battle = withSwarm(load(), "s2", { at: { x: 2, y: 4 } });
    const orders = [engulf("s1", "p1", { x: 1, y: 3 })];
    expect(engulfTargets(battle, "s2").map((t) => t.pathogenId)).toEqual([
      "p1",
    ]);
    expect(engulfTargets(battle, "s2", orders)).toEqual([]);
    // s1's own pending order does not hide its target.
    expect(engulfTargets(battle, "s1", orders)).toHaveLength(1);
  });

  it("previews kill, roll and load outcomes with odds, load and move range", () => {
    const battle = load();
    expect(
      engulfPreview(battle, [], engulf("s1", "p1", { x: 1, y: 3 })),
    ).toEqual({
      reason: null,
      pathogenId: "p1",
      wall: "leaky",
      outcome: "kills",
      killChance: 1,
      path: [
        { x: 1, y: 6 },
        { x: 1, y: 5 },
        { x: 1, y: 4 },
        { x: 1, y: 3 },
      ],
      loadIfLoaded: [],
      moveRangeIfLoaded: 3,
      moveRangeIfKilled: 3,
    });
    expect(
      engulfPreview(battle, [], engulf("s3", "p2", { x: 5, y: 3 })),
    ).toMatchObject({
      reason: null,
      outcome: "residualRoll",
      killChance: 0.1,
      loadIfLoaded: [{ kind: "aspergillus", size: 2 }],
      moveRangeIfLoaded: 2,
      moveRangeIfKilled: 3,
    });
    expect(
      engulfPreview(
        { ...battle, residualKillChance: 0 },
        [],
        engulf("s3", "p2", null),
      ),
    ).toMatchObject({ outcome: "loads", reason: "p2 is not next to 5,6" });
    expect(
      engulfPreview(
        { ...battle, residualKillChance: 1 },
        [],
        engulf("s3", "p2", null),
      ),
    ).toMatchObject({ outcome: "kills" });
    // Checked after the other pending orders, replacing this swarm's own.
    const pending = [engulf("s3", "p2", { x: 5, y: 3 })];
    expect(
      engulfPreview(battle, pending, engulf("s1", "p2", null))?.reason,
    ).toBe("s3 is already engulfing p2");
    expect(
      engulfPreview(battle, pending, engulf("s3", "p2", { x: 4, y: 2 }))
        ?.reason,
    ).toBe("4,2 is 5 steps away, max 3");
    expect(engulfPreview(battle, [], engulf("s1", "p7", null))).toBeNull();
  });
});

describe("random legal orders with engulfs", () => {
  it("preview matches resolve and state stays valid", () => {
    let rng: RngState = rngFromSeed(7);
    const pick = <T>(xs: readonly T[]): T => {
      const r = rngInt(rng, xs.length);
      rng = r.rng;
      return xs[r.value];
    };
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      let battle = load(seed, 0.5);
      while (!battleStatus(battle).over) {
        let orders: Order[] = [];
        for (const s of battle.swarms) {
          const targets = engulfTargets(battle, s.id, orders);
          const moves = moveOptions(battle, s.id, orders);
          const choice = pick<Order | null>([
            null,
            ...targets.map((x) => engulf(s.id, x.pathogenId, pick(x.froms))),
            ...targets.map((x) => engulf(s.id, x.pathogenId, x.from)),
            ...moves.map((m): Order => ({
              type: "move",
              swarmId: s.id,
              to: m.at,
            })),
            ...(s.load.length > 0 && s.busyTurns === 0
              ? [{ type: "wallOff", swarmId: s.id } as Order]
              : []),
          ]);
          orders = withOrder(orders, choice ?? { type: "hold", swarmId: s.id });
        }
        expect(orderProblems(battle, orders)).toEqual([]);
        const marks = telegraph(battle, orders);
        const { state, events } = resolveTurn(battle, orders);
        expect(validateBattle(state)).toEqual([]);
        for (const e of events) seen.add(e.type);
        for (const m of marks) {
          const after = state.pathogens.find((p) => p.id === m.pathogenId);
          if (m.cancelledBy) {
            expect(after).toBeUndefined();
            expect(
              events.some(
                (e) =>
                  e.type === "Engulfed" &&
                  e.pathogenId === m.pathogenId &&
                  e.swarmId === m.cancelledBy,
              ),
            ).toBe(true);
            if (m.to) {
              const to = m.to;
              expect(
                events.some(
                  (e) =>
                    (e.type === "Spread" || e.type === "Spored") &&
                    sameCoord(e.to, to),
                ),
              ).toBe(false);
            }
          } else {
            expect(after?.size).toBe(m.sizeAfter);
          }
        }
        battle = state;
      }
    }
    expect([...seen]).toEqual(
      expect.arrayContaining([
        "Engulfed",
        "Killed",
        "Loaded",
        "ResidualKill",
        "Walled",
        "InflammationChanged",
      ]),
    );
  });
});

describe("validateBattle load rules", () => {
  it("flags an over-cap load, a leaky load and an out-of-range residual chance", () => {
    const battle = {
      ...withSwarm(load(), "s1", {
        load: [MOLD, MOLD, { kind: "strep", size: 1 }],
      }),
      residualKillChance: 1.5,
    };
    expect(validateBattle(battle)).toEqual([
      "s1 load 3 is over cap 2",
      "s1 holds leaky strep",
      "residualKillChance 1.5 is outside 0..1",
    ]);
  });
});
