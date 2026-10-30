import { describe, expect, it } from "vitest";
import { sameCoord } from "../board";
import { PARAMS } from "../params";
import { rngFromSeed, rngInt, type RngState } from "../rng";
import { loadScenario } from "../scenarios";
import type { BattleState, Coord, Order, Swarm } from "../types";
import { validateBattle } from "../validate";
import { telegraph } from "./intents";
import {
  moveOptions,
  movePath,
  orderProblems,
  validateOrders,
  withOrder,
} from "./orders";
import { resolveTurn } from "./resolve";

function load(seed = 1): BattleState {
  return loadScenario("first-board", seed) as BattleState;
}

const move = (swarmId: string, x: number, y: number): Order => ({
  type: "move",
  swarmId,
  to: { x, y },
});

const reasons = (battle: BattleState, orders: Order[]) =>
  validateOrders(battle, orders).map((c) => c.reason);

function swarm(id: string, x: number, y: number, busyTurns = 0): Swarm {
  return { id, at: { x, y }, load: [], busyTurns };
}

/** First board with swarms and blockers placed by hand. Intents are kept only if still valid. */
function custom(
  swarms: Swarm[],
  walls: { pathogens?: Coord[]; granulomas?: Coord[] } = {},
): BattleState {
  const base = load();
  const pathogens = (walls.pathogens ?? []).map((at, k) => ({
    id: `p${k + 1}`,
    kind: "strep" as const,
    size: 1,
    at,
    hidden: false,
  }));
  return {
    ...base,
    swarms,
    pathogens,
    granulomas: (walls.granulomas ?? []).map((at, k) => ({
      id: `g${k + 1}`,
      at,
      contents: [],
    })),
    intents: [],
  };
}

describe("validateOrders", () => {
  it("accepts a move within range and returns its path", () => {
    const battle = load();
    const [check] = validateOrders(battle, [move("s1", 1, 3)]);
    expect(check.reason).toBeNull();
    expect(check.path).toEqual([
      { x: 1, y: 6 },
      { x: 1, y: 5 },
      { x: 1, y: 4 },
      { x: 1, y: 3 },
    ]);
    expect(PARAMS.swarmMoveRange).toBe(3);
  });

  it("rejects moves out of range, off the board, or to the swarm's own tile", () => {
    const battle = load();
    expect(
      reasons(battle, [move("s1", 0, 3), move("s2", 7, 6), move("s3", 5, 6)]),
    ).toEqual([
      "0,3 is 4 steps away, max 3",
      "7,6 is off the board",
      "s3 is already there",
    ]);
  });

  it("rejects pathogen and granuloma tiles and counts detours around them", () => {
    const battle = custom([swarm("s1", 0, 6)], {
      granulomas: [{ x: 0, y: 5 }],
      pathogens: [{ x: 1, y: 5 }],
    });
    expect(reasons(battle, [move("s1", 0, 5)])).toEqual(["0,5 is blocked"]);
    expect(reasons(battle, [move("s1", 1, 5)])).toEqual(["1,5 is blocked"]);
    // Straight up is 2 steps, but the walls force a 6-step detour.
    expect(reasons(battle, [move("s1", 0, 4)])).toEqual([
      "0,4 is 6 steps away, max 3",
    ]);
    expect(reasons(battle, [move("s1", 2, 5)])).toEqual([null]);
  });

  it("reports no path when a swarm is walled in", () => {
    const battle = custom([swarm("s1", 0, 6)], {
      granulomas: [{ x: 0, y: 5 }],
      pathogens: [{ x: 1, y: 6 }],
    });
    expect(reasons(battle, [move("s1", 2, 6)])).toEqual(["no path to 2,6"]);
    expect(moveOptions(battle, "s1")).toEqual([]);
  });

  it("lets a swarm pass through another swarm but not stop on it", () => {
    const battle = custom([swarm("s1", 0, 6), swarm("s2", 1, 6)], {
      pathogens: [{ x: 0, y: 5 }],
    });
    const [check] = validateOrders(battle, [move("s1", 2, 6)]);
    expect(check.path).toEqual([
      { x: 0, y: 6 },
      { x: 1, y: 6 },
      { x: 2, y: 6 },
    ]);
    expect(reasons(battle, [move("s1", 1, 6)])).toEqual(["s2 stands on 1,6"]);
    const options = moveOptions(battle, "s1").map((r) => r.at);
    expect(options).toContainEqual({ x: 2, y: 6 });
    expect(options).not.toContainEqual({ x: 1, y: 6 });
  });

  it("gives a shared destination to the earlier order", () => {
    const battle = load();
    expect(reasons(battle, [move("s1", 2, 5), move("s2", 2, 5)])).toEqual([
      null,
      "s1 is already moving to 2,5",
    ]);
    expect(reasons(battle, [move("s2", 2, 5), move("s1", 2, 5)])).toEqual([
      null,
      "s2 is already moving to 2,5",
    ]);
    // A rejected move claims nothing.
    expect(reasons(battle, [move("s1", 0, 3), move("s2", 0, 3)])).toEqual([
      "0,3 is 4 steps away, max 3",
      "0,3 is 6 steps away, max 3",
    ]);
  });

  it("forbids ending on a tile another swarm is vacating, including swaps", () => {
    const battle = load();
    expect(reasons(battle, [move("s2", 3, 4), move("s1", 3, 6)])).toEqual([
      null,
      "s2 stands on 3,6",
    ]);
    expect(reasons(battle, [move("s1", 3, 6), move("s2", 1, 6)])).toEqual([
      "s2 stands on 3,6",
      "s1 stands on 1,6",
    ]);
  });

  it("rejects a busy swarm's move but not its hold", () => {
    const base = load();
    const battle: BattleState = {
      ...base,
      swarms: [{ ...base.swarms[0], busyTurns: 1 }, ...base.swarms.slice(1)],
    };
    expect(reasons(battle, [move("s1", 1, 5)])).toEqual(["s1 is busy"]);
    expect(reasons(battle, [{ type: "hold", swarmId: "s1" }])).toEqual([null]);
    expect(moveOptions(battle, "s1")).toEqual([]);
    expect(movePath(battle, "s1", { x: 1, y: 5 })).toBeNull();
  });

  it("rejects a second order, a missing swarm, a bad engulf and unsupported types", () => {
    const battle = load();
    expect(
      reasons(battle, [
        move("s1", 1, 5),
        { type: "hold", swarmId: "s1" },
        { type: "hold", swarmId: "s9" },
        { type: "engulf", swarmId: "s2", pathogenId: "p1", from: null },
        { type: "wallOff", swarmId: "s3" },
      ]),
    ).toEqual([
      null,
      "two orders for s1",
      "no swarm s9",
      "p1 is not next to 3,6",
      "wallOff orders are not supported yet",
    ]);
  });
});

describe("moveOptions and movePath", () => {
  it("lists tiles within range and leaves out other swarms' pending destinations", () => {
    const battle = load();
    const all = moveOptions(battle, "s2");
    expect(all.every((r) => r.steps >= 1 && r.steps <= 3)).toBe(true);
    expect(all.map((r) => r.at)).toContainEqual({ x: 2, y: 5 });
    const orders = [move("s1", 2, 5), move("s2", 3, 3)];
    const pending = moveOptions(battle, "s2", orders).map((r) => r.at);
    expect(pending).not.toContainEqual({ x: 2, y: 5 });
    // s2's own pending order does not hide its destination.
    expect(pending).toContainEqual({ x: 3, y: 3 });
    for (const r of all) {
      expect(movePath(battle, "s2", r.at)?.length).toBe(r.steps + 1);
    }
    expect(movePath(battle, "s2", { x: 3, y: 2 })).toBeNull();
  });

  it("withOrder replaces a swarm's order and keeps swarm order", () => {
    const orders = withOrder(withOrder([move("s2", 3, 5)], move("s1", 1, 5)), {
      type: "hold",
      swarmId: "s2",
    });
    expect(orders).toEqual([move("s1", 1, 5), { type: "hold", swarmId: "s2" }]);
  });
});

describe("resolveTurn with moves", () => {
  /** p1 (strep at 1,2) telegraphs a spread onto 1,3. */
  function spreadingAt13(): BattleState {
    const base = load();
    return {
      ...base,
      intents: [
        {
          type: "spread",
          pathogenId: "p1",
          to: { x: 1, y: 3 },
          size: 1,
          cost: 0,
        },
      ],
    };
  }

  it("moves first, emitting SwarmMoved with the path, in swarm order", () => {
    const battle = load();
    const { state, events } = resolveTurn(battle, [
      move("s3", 5, 4),
      move("s1", 1, 4),
    ]);
    expect(events.slice(0, 2)).toEqual([
      {
        type: "SwarmMoved",
        swarmId: "s1",
        path: [
          { x: 1, y: 6 },
          { x: 1, y: 5 },
          { x: 1, y: 4 },
        ],
      },
      {
        type: "SwarmMoved",
        swarmId: "s3",
        path: [
          { x: 5, y: 6 },
          { x: 5, y: 5 },
          { x: 5, y: 4 },
        ],
      },
    ]);
    expect(state.swarms.map((s) => s.at)).toEqual([
      { x: 1, y: 4 },
      { x: 3, y: 6 },
      { x: 5, y: 4 },
    ]);
  });

  it("blocks a spread with a swarm that moves into it, and the preview shows it first", () => {
    const battle = spreadingAt13();
    const orders = [move("s1", 1, 3)];
    expect(telegraph(battle)[0].blockedBy).toBeNull();
    expect(telegraph(battle, orders)[0]).toMatchObject({
      blockedBy: "s1",
      sizeAfter: 2,
    });
    const { state, events } = resolveTurn(battle, orders);
    expect(events.map((e) => e.type)).toEqual(["SwarmMoved", "Blocked"]);
    expect(events[1]).toEqual({
      type: "Blocked",
      pathogenId: "p1",
      intent: "spread",
      at: { x: 1, y: 3 },
      swarmId: "s1",
    });
    expect(state.pathogens).toEqual(battle.pathogens);
  });

  it("lets a spread land when the blocking swarm moves away", () => {
    const base = spreadingAt13();
    const battle: BattleState = {
      ...base,
      swarms: [
        { ...base.swarms[0], at: { x: 1, y: 3 } },
        ...base.swarms.slice(1),
      ],
    };
    const orders = [move("s1", 1, 5)];
    expect(telegraph(battle)[0].blockedBy).toBe("s1");
    expect(telegraph(battle, orders)[0].blockedBy).toBeNull();
    const { events } = resolveTurn(battle, orders);
    expect(events.map((e) => e.type)).toEqual(["SwarmMoved", "Spread"]);
  });

  it("rejects the whole set without changing anything and lists every reason", () => {
    const battle = load();
    const before = JSON.parse(JSON.stringify(battle)) as BattleState;
    const orders = [move("s1", 1, 4), move("s2", 1, 6), move("s3", 0, 0)];
    expect(orderProblems(battle, orders)).toEqual([
      "s1 stands on 1,6",
      "0,0 is 11 steps away, max 3",
    ]);
    expect(() => resolveTurn(battle, orders)).toThrow(
      "invalid orders: s1 stands on 1,6; 0,0 is 11 steps away, max 3",
    );
    expect(battle).toEqual(before);
  });

  it("previews truthfully and keeps state valid under random legal orders", () => {
    let rng: RngState = rngFromSeed(99);
    const pick = <T>(xs: readonly T[]): T => {
      const r = rngInt(rng, xs.length);
      rng = r.rng;
      return xs[r.value];
    };
    let blocks = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let battle = load(seed);
      for (let t = 0; t < 6; t++) {
        let orders: Order[] = [];
        for (const s of battle.swarms) {
          const options = moveOptions(battle, s.id, orders);
          const choice = pick([null, ...options]);
          orders = withOrder(
            orders,
            choice
              ? { type: "move", swarmId: s.id, to: choice.at }
              : { type: "hold", swarmId: s.id },
          );
        }
        expect(orderProblems(battle, orders)).toEqual([]);
        const marks = telegraph(battle, orders);
        const result = resolveTurn(battle, orders);
        expect(JSON.parse(JSON.stringify(result))).toEqual(result);
        expect(resolveTurn(battle, orders)).toEqual(result);
        const { state, events } = result;
        expect(validateBattle(state)).toEqual([]);
        for (const m of marks) {
          const after = state.pathogens.find((p) => p.id === m.pathogenId);
          expect(after?.size).toBe(m.sizeAfter);
          if (!m.to) continue;
          const blocked = events.find(
            (e) => e.type === "Blocked" && e.pathogenId === m.pathogenId,
          );
          expect(blocked && "swarmId" in blocked ? blocked.swarmId : null).toBe(
            m.blockedBy,
          );
          if (m.blockedBy) {
            blocks++;
            const at = m.to;
            expect(state.pathogens.some((p) => sameCoord(p.at, at))).toBe(
              false,
            );
          }
        }
        battle = state;
      }
    }
    expect(blocks).toBeGreaterThan(0);
  });
});
