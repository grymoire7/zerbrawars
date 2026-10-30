import { describe, expect, it } from "vitest";
import { sameCoord, tileId } from "../board";
import { PARAMS } from "../params";
import { rngFromSeed, rngInt, type RngState } from "../rng";
import { loadScenario } from "../scenarios";
import type {
  BattleState,
  Contained,
  Coord,
  Order,
  SimEvent,
  Swarm,
} from "../types";
import { validateBattle } from "../validate";
import { generateIntents, landingBlockers } from "./intents";
import { inflammationAt } from "./inflammation";
import {
  engulfTargets,
  moveOptions,
  moveRange,
  orderProblems,
  swarmMoveRange,
  validateOrders,
  wallOffPreview,
  withOrder,
} from "./orders";
import { battleStatus } from "./outcome";
import { inflammationPreview, resolveTurn } from "./resolve";

// Duel board: s1 1,6  s2 3,6  s3 5,6; p1 strep (leaky) size 2 at 1,2; p2 aspergillus (sealed)
// size 2 at 5,2. Intents are cleared in most fixtures so only the rule under test acts.

const I = PARAMS.inflammation;
const MOLD: Contained = { kind: "aspergillus", size: 2 };
const wallOff = (swarmId: string): Order => ({ type: "wallOff", swarmId });
const move = (swarmId: string, x: number, y: number): Order => ({
  type: "move",
  swarmId,
  to: { x, y },
});

function quiet(patch: Partial<BattleState> = {}): BattleState {
  const b = loadScenario("duel", 1) as BattleState;
  return { ...b, intents: [], residualKillChance: 0, ...patch };
}

const withSwarm = (
  battle: BattleState,
  id: string,
  patch: Partial<Swarm>,
): BattleState => ({
  ...battle,
  swarms: battle.swarms.map((s) => (s.id === id ? { ...s, ...patch } : s)),
});

function withHeat(battle: BattleState, heat: [Coord, number][]): BattleState {
  const tiles = [...battle.board.tiles];
  for (const [at, v] of heat)
    tiles[tileId(battle.board, at)] = { inflammation: v };
  return { ...battle, board: { ...battle.board, tiles } };
}

const heatAt = (b: BattleState, x: number, y: number) =>
  inflammationAt(b, { x, y });
const types = (events: readonly SimEvent[]) => events.map((e) => e.type);

describe("wall off validation", () => {
  it("needs a free swarm with a load, not already on a granuloma", () => {
    const loaded = withSwarm(quiet(), "s1", { load: [MOLD] });
    expect(
      validateOrders(loaded, [wallOff("s1"), wallOff("s2")]).map(
        (c) => c.reason,
      ),
    ).toEqual([null, "s2 has nothing to wall off"]);
    const busy = withSwarm(loaded, "s1", { busyTurns: 1 });
    expect(orderProblems(busy, [wallOff("s1")])).toEqual(["s1 is busy"]);
    const onGranuloma: BattleState = {
      ...loaded,
      granulomas: [{ id: "g9", at: { x: 1, y: 6 }, contents: [MOLD] }],
    };
    expect(orderProblems(onGranuloma, [wallOff("s1")])).toEqual([
      "s1 already stands on a granuloma",
    ]);
  });

  it("previews the granuloma, its heat and cost, and the busy turns", () => {
    const loaded = withSwarm(quiet(), "s1", { load: [MOLD, MOLD] });
    expect(wallOffPreview(loaded, "s1")).toEqual({
      reason: null,
      at: { x: 1, y: 6 },
      contents: [MOLD, MOLD],
      inflammation: I.granulomaInflammation,
      tissuePerTurn: Math.max(0, I.granulomaInflammation - I.damageThreshold),
      busyTurns: PARAMS.wallOffBusyTurns,
    });
    expect(wallOffPreview(loaded, "s2")?.reason).toBe(
      "s2 has nothing to wall off",
    );
    expect(wallOffPreview(loaded, "s9")).toBeNull();
  });
});

describe("wall off resolution", () => {
  const start = withSwarm(quiet(), "s1", { load: [MOLD, MOLD] });

  it("turns the load into a granuloma on the swarm's tile and frees the swarm after one turn", () => {
    const { state, events } = resolveTurn(start, [wallOff("s1")]);
    expect(events[0]).toEqual({
      type: "Walled",
      swarmId: "s1",
      granulomaId: `g${start.nextId}`,
      at: { x: 1, y: 6 },
    });
    expect(state.granulomas).toEqual([
      { id: `g${start.nextId}`, at: { x: 1, y: 6 }, contents: [MOLD, MOLD] },
    ]);
    expect(state.nextId).toBe(start.nextId + 1);
    const s1 = state.swarms[0];
    expect(s1.load).toEqual([]);
    expect(s1.busyTurns).toBe(PARAMS.wallOffBusyTurns);
    expect(validateBattle(state)).toEqual([]);

    // Busy for the next turn: no move, engulf or wall-off, and no move options.
    expect(orderProblems(state, [move("s1", 1, 5)])).toEqual(["s1 is busy"]);
    expect(moveOptions(state, "s1")).toEqual([]);
    expect(engulfTargets(state, "s1")).toEqual([]);
    const next = resolveTurn(state, []).state;
    expect(next.swarms[0].busyTurns).toBe(0);
    // Free again, and it can step off the granuloma it stands on.
    expect(orderProblems(next, [move("s1", 1, 5)])).toEqual([]);
    const off = resolveTurn(next, [move("s1", 1, 5)]).state;
    expect(off.swarms[0].at).toEqual({ x: 1, y: 5 });
    expect(off.granulomas).toHaveLength(1);
  });

  it("heats the granuloma tile and keeps a floor under it", () => {
    let { state } = resolveTurn(start, [wallOff("s1")]);
    expect(heatAt(state, 1, 6)).toBe(I.granulomaRise);
    for (let t = 0; t < 3; t++) state = resolveTurn(state, []).state;
    expect(heatAt(state, 1, 6)).toBe(I.granulomaInflammation);
  });

  it("blocks movement and spread or spore landings", () => {
    const g = { id: "g9", at: { x: 2, y: 5 }, contents: [MOLD] };
    const battle: BattleState = { ...quiet(), granulomas: [g] };
    expect(validateBattle(battle)).toEqual([]);
    expect(orderProblems(battle, [move("s1", 2, 5)])).toEqual([
      "2,5 is blocked",
    ]);
    expect(moveOptions(battle, "s2").some((r) => sameCoord(r.at, g.at))).toBe(
      false,
    );
    expect(landingBlockers(battle).has(tileId(battle.board, g.at))).toBe(true);
    // A strep next to the granuloma never telegraphs a spread onto it.
    for (let seed = 1; seed <= 100; seed++) {
      const b = generateIntents({
        ...quiet(),
        granulomas: [g],
        pathogens: [
          {
            id: "p1",
            kind: "strep",
            size: 3,
            at: { x: 2, y: 4 },
            hidden: false,
          },
        ],
        rng: { ...battle.rng, intents: rngFromSeed(seed) },
      });
      for (const i of b.intents) {
        if (i.type === "spread" || i.type === "spore")
          expect(sameCoord(i.to, g.at)).toBe(false);
      }
    }
  });
});

describe("carried loads", () => {
  it("roll the residual chance again each turn they are carried", () => {
    const sure = withSwarm(quiet({ residualKillChance: 1 }), "s1", {
      load: [MOLD],
    });
    const { state, events } = resolveTurn(sure, []);
    expect(events.slice(0, 2)).toEqual([
      {
        type: "ResidualKill",
        swarmId: "s1",
        chance: Math.min(1, PARAMS.carriedKillScale),
        success: true,
      },
      { type: "Loaded", swarmId: "s1", load: [] },
    ]);
    expect(state.swarms[0].load).toEqual([]);

    const never = withSwarm(quiet(), "s1", { load: [MOLD] });
    const r = resolveTurn(never, []);
    expect(r.events[0]).toMatchObject({ type: "ResidualKill", success: false });
    expect(r.state.swarms[0].load).toEqual([MOLD]);
  });

  it("are not rolled twice on the turn they load, nor once walled off", () => {
    const base = quiet();
    const engulfing = withSwarm(base, "s3", { at: { x: 5, y: 3 } });
    const engulfed = resolveTurn(engulfing, [
      { type: "engulf", swarmId: "s3", pathogenId: "p2", from: null },
    ]);
    expect(types(engulfed.events).filter((t) => t === "ResidualKill")).toEqual([
      "ResidualKill",
    ]);
    const walled = resolveTurn(withSwarm(base, "s1", { load: [MOLD] }), [
      wallOff("s1"),
    ]);
    expect(types(walled.events)).not.toContain("ResidualKill");
  });
});

describe("inflammation", () => {
  it("does not rise on the starting line, and decays by one a turn", () => {
    const hot = withHeat(quiet(), [[{ x: 3, y: 3 }, 3]]);
    const { state, events } = resolveTurn(hot, []);
    expect(heatAt(state, 3, 3)).toBe(3 - I.decay);
    // Only p1 and p2 heat their own tiles; the swarms stand two apart.
    expect(
      events.flatMap((e) =>
        e.type === "InflammationChanged" ? [`${e.at.x},${e.at.y}`] : [],
      ),
    ).toEqual(["1,2", "5,2", "3,3"]);
  });

  it("rises where swarms touch, diagonals included, per touching swarm", () => {
    const clump = quiet({
      swarms: [
        { id: "s1", at: { x: 2, y: 5 }, load: [], busyTurns: 0 },
        { id: "s2", at: { x: 3, y: 5 }, load: [], busyTurns: 0 },
        { id: "s3", at: { x: 4, y: 4 }, load: [], busyTurns: 0 },
      ],
    });
    const { state } = resolveTurn(clump, []);
    expect(heatAt(state, 2, 5)).toBe(I.crowdRise);
    expect(heatAt(state, 3, 5)).toBe(2 * I.crowdRise);
    expect(heatAt(state, 4, 4)).toBe(I.crowdRise);
  });

  it("rises under a pathogen (not a hidden one) and under a loaded swarm", () => {
    const base = quiet();
    const battle = withSwarm(
      {
        ...base,
        pathogens: base.pathogens.map((p) =>
          p.id === "p2" ? { ...p, hidden: true } : p,
        ),
      },
      "s3",
      { load: [MOLD] },
    );
    const { state } = resolveTurn({ ...battle, intents: [] }, []);
    expect(heatAt(state, 1, 2)).toBe(I.pathogenRise);
    expect(heatAt(state, 5, 2)).toBe(0);
    expect(heatAt(state, 5, 6)).toBe(I.loadRise);
  });

  it("clamps at the maximum", () => {
    const battle = withHeat(quiet(), [
      [{ x: 1, y: 2 }, PARAMS.maxInflammation],
    ]);
    expect(heatAt(resolveTurn(battle, []).state, 1, 2)).toBe(
      PARAMS.maxInflammation,
    );
  });

  it("costs a swarm moves at the slow threshold, never below the minimum", () => {
    const s1 = quiet().swarms[0];
    expect(moveRange(s1, I.slowThreshold - 1)).toBe(PARAMS.swarmMoveRange);
    expect(moveRange(s1, I.slowThreshold)).toBe(
      PARAMS.swarmMoveRange - I.inflammationMovePenalty,
    );
    expect(moveRange({ ...s1, load: [MOLD, MOLD] }, I.slowThreshold)).toBe(
      PARAMS.minLoadedMoveRange,
    );
    const hot = withHeat(quiet(), [[s1.at, I.slowThreshold]]);
    expect(swarmMoveRange(hot, s1)).toBe(2);
    expect(orderProblems(hot, [move("s1", 1, 3)])).toEqual([
      "1,3 is 3 steps away, max 2",
    ]);
    expect(Math.max(...moveOptions(hot, "s1").map((r) => r.steps))).toBe(2);
  });

  it("drains tissue health per level above the threshold, never below zero", () => {
    const battle = withHeat(quiet(), [
      [{ x: 0, y: 0 }, 3],
      [{ x: 6, y: 0 }, 3],
    ]);
    const { state, events } = resolveTurn(battle, []);
    // Both decay to 2; p1 and p2 rise to 1.
    const damage = 2 * (2 - I.damageThreshold) * I.damagePerLevel;
    expect(events[events.length - 1]).toEqual({
      type: "TissueDamaged",
      amount: damage,
      tissueHealth: battle.tissueHealth - damage,
    });
    expect(state.tissueHealth).toBe(battle.tissueHealth - damage);
    const low = resolveTurn({ ...battle, tissueHealth: 1 }, []);
    expect(low.state.tissueHealth).toBe(0);
    expect(low.events[low.events.length - 1]).toMatchObject({ amount: 1 });
  });

  it("heats and slows three swarms flooded into one spot", () => {
    let battle = quiet({
      pathogens: [
        { id: "p1", kind: "strep", size: 1, at: { x: 0, y: 0 }, hidden: false },
      ],
    });
    battle = resolveTurn(battle, [
      move("s1", 2, 4),
      move("s2", 3, 4),
      move("s3", 4, 4),
    ]).state;
    battle = resolveTurn({ ...battle, intents: [] }, []).state;
    expect(heatAt(battle, 3, 4)).toBe(PARAMS.maxInflammation);
    expect(heatAt(battle, 2, 4)).toBe(2);
    for (const s of battle.swarms) {
      expect(swarmMoveRange(battle, s)).toBe(
        PARAMS.swarmMoveRange - I.inflammationMovePenalty,
      );
    }
    expect(battle.tissueHealth).toBeLessThan(PARAMS.maxTissueHealth);
  });
});

describe("inflammationPreview", () => {
  it("warns before committing: rising tiles, causes, damage and slowed swarms", () => {
    const battle = withHeat(quiet(), [
      [{ x: 2, y: 4 }, 1],
      [{ x: 3, y: 4 }, 1],
    ]);
    const orders = [move("s1", 2, 4), move("s2", 3, 4)];
    const pv = inflammationPreview(battle, orders);
    expect(pv.rising.map((t) => [t.at, t.after, t.causes])).toEqual([
      [{ x: 1, y: 2 }, 1, ["pathogen"]],
      [{ x: 5, y: 2 }, 1, ["pathogen"]],
      [{ x: 2, y: 4 }, 2, ["crowd"]],
      [{ x: 3, y: 4 }, 2, ["crowd"]],
    ]);
    expect(pv.falling).toEqual([]);
    expect(pv.tissueDamage).toBe(2);
    expect(pv.slowed).toEqual(["s1", "s2"]);
    // Ignores invalid orders instead of throwing.
    expect(inflammationPreview(battle, [move("s1", 0, 0)]).slowed).toEqual([]);
  });

  it("matches what resolveTurn does under random legal orders, wall-offs included", () => {
    let rng: RngState = rngFromSeed(3);
    const pick = <T>(xs: readonly T[]): T => {
      const r = rngInt(rng, xs.length);
      rng = r.rng;
      return xs[r.value];
    };
    let walled = 0;
    for (let seed = 1; seed <= 150; seed++) {
      let battle = loadScenario("first-board", seed) as BattleState;
      battle = { ...battle, residualKillChance: 0.3 };
      while (!battleStatus(battle).over) {
        let orders: Order[] = [];
        for (const s of battle.swarms) {
          const options: Order[] = [
            ...engulfTargets(battle, s.id, orders).map((e): Order => ({
              type: "engulf",
              swarmId: s.id,
              pathogenId: e.pathogenId,
              from: e.from,
            })),
            ...moveOptions(battle, s.id, orders).map((r) =>
              move(s.id, r.at.x, r.at.y),
            ),
          ];
          if (s.load.length > 0 && s.busyTurns === 0)
            options.push(wallOff(s.id));
          const o = pick([null, ...options]);
          if (o) orders = withOrder(orders, o);
        }
        const pv = inflammationPreview(battle, orders);
        const { state, events } = resolveTurn(battle, orders);
        expect(validateBattle(state)).toEqual([]);
        const changed = events.flatMap((e) =>
          e.type === "InflammationChanged" ? [[e.at, e.inflammation]] : [],
        );
        expect(changed).toEqual(
          [...pv.rising, ...pv.falling]
            .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x)
            .map((t) => [t.at, t.after]),
        );
        const dmg = events.find((e) => e.type === "TissueDamaged");
        expect(dmg && "amount" in dmg ? dmg.amount : 0).toBe(pv.tissueDamage);
        expect(pv.slowed).toEqual(
          state.swarms
            .filter((s) => heatAt(state, s.at.x, s.at.y) >= I.slowThreshold)
            .map((s) => s.id),
        );
        walled += events.filter((e) => e.type === "Walled").length;
        battle = state;
      }
    }
    expect(walled).toBeGreaterThan(0);
  });
});
