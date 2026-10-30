import { describe, expect, it } from "vitest";
import { distance, isAdjacent, sameCoord } from "../board";
import { PARAMS } from "../params";
import { pathogenKind } from "../pathogens";
import { loadScenario } from "../scenarios";
import type { BattleState, Pathogen, SimEvent } from "../types";
import { validateBattle } from "../validate";
import { generateIntents, telegraph } from "./intents";
import { resolveTurn } from "./resolve";

const SEEDS = 1000;
const TURNS = 6;

function load(seed: number): BattleState {
  return loadScenario("first-board", seed) as BattleState;
}

/** What the telegraph promises for a zero-order turn, computed straight from the intents. */
function promise(battle: BattleState): {
  pathogens: Pathogen[];
  events: SimEvent["type"][];
} {
  const pathogens = battle.pathogens.map((p) => ({ ...p }));
  const events: SimEvent["type"][] = [];
  let nextId = battle.nextId;
  for (const i of battle.intents) {
    const p = pathogens.find((q) => q.id === i.pathogenId) as Pathogen;
    if (i.type === "grow") {
      Object.assign(p, { size: p.size + i.amount });
      events.push("Grew");
    } else if (battle.swarms.some((s) => sameCoord(s.at, i.to))) {
      events.push("Blocked");
    } else {
      pathogens.push({
        id: `p${nextId++}`,
        kind: p.kind,
        size: i.size,
        at: i.to,
        hidden: false,
      });
      Object.assign(p, { size: p.size - i.cost });
      events.push(i.type === "spread" ? "Spread" : "Spored");
    }
  }
  return { pathogens, events };
}

function run(seed: number, turns = TURNS): BattleState[] {
  const states = [load(seed)];
  for (let t = 0; t < turns; t++) {
    states.push(resolveTurn(states[states.length - 1], []).state);
  }
  return states;
}

describe("zero orders equals telegraph", () => {
  it(`holds for ${SEEDS} seeds over ${TURNS} turns`, () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      let battle = load(seed);
      for (let t = 0; t < TURNS; t++) {
        const expected = promise(battle);
        const { state, events } = resolveTurn(battle, []);
        expect(state.pathogens).toEqual(expected.pathogens);
        expect(events.map((e) => e.type)).toEqual(expected.events);
        events.forEach((e, k) => {
          expect("pathogenId" in e && e.pathogenId).toBe(
            battle.intents[k].pathogenId,
          );
        });
        for (const e of events) seen.add(e.type);
        expect(state.swarms).toEqual(battle.swarms);
        expect(state.turn).toBe(battle.turn + 1);
        battle = state;
      }
    }
    // The first board must actually exercise every pathogen action, including a block.
    expect([...seen].sort()).toEqual(["Blocked", "Grew", "Spored", "Spread"]);
  });

  it("matches the telegraph marks the renderer draws", () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const battle of run(seed).slice(0, -1)) {
        const next = resolveTurn(battle, []).state;
        for (const m of telegraph(battle)) {
          const after = next.pathogens.find((p) => p.id === m.pathogenId);
          expect(after?.size).toBe(m.sizeAfter);
          if (m.to && !m.blockedBy) {
            const child = next.pathogens.find((p) => sameCoord(p.at, m.to!));
            expect(child?.size).toBe(m.childSize);
          }
        }
      }
    }
  });
});

describe("intents", () => {
  it("are legal, unique per pathogen and target, and valid every turn", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const battle of run(seed)) {
        expect(validateBattle(battle)).toEqual([]);
        const targets = new Set<string>();
        for (const i of battle.intents) {
          const p = battle.pathogens.find((q) => q.id === i.pathogenId);
          expect(p).toBeDefined();
          if (!p) continue;
          if (i.type === "grow") {
            expect(i.amount).toBeGreaterThan(0);
            expect(p.size + i.amount).toBeLessThanOrEqual(
              PARAMS.maxPathogenSize,
            );
            continue;
          }
          const key = `${i.to.x},${i.to.y}`;
          expect(targets.has(key)).toBe(false);
          targets.add(key);
          expect(battle.pathogens.some((q) => sameCoord(q.at, i.to))).toBe(
            false,
          );
          expect(battle.granulomas.some((g) => sameCoord(g.at, i.to))).toBe(
            false,
          );
          expect(p.size - i.cost).toBeGreaterThanOrEqual(1);
          if (i.type === "spread") {
            expect(pathogenKind(p.kind).canSpore).toBe(false);
            expect(isAdjacent(p.at, i.to)).toBe(true);
          } else {
            expect(pathogenKind(p.kind).canSpore).toBe(true);
            const b = PARAMS.intents[p.kind];
            expect(distance(p.at, i.to)).toBeGreaterThanOrEqual(
              b.sporeMinDistance,
            );
            expect(distance(p.at, i.to)).toBeLessThanOrEqual(
              b.sporeMaxDistance,
            );
          }
        }
      }
    }
  });

  it("are already rolled when a scenario loads", () => {
    const battle = load(1);
    expect(battle.intents.map((i) => i.pathogenId)).toEqual(["p1", "p2"]);
    // The mold starts below spore size, so turn 1 always shows it growing.
    expect(battle.intents[1]).toEqual({
      type: "grow",
      pathogenId: "p2",
      amount: 1,
    });
  });

  it("skip hidden pathogens", () => {
    const base = load(3);
    const battle = generateIntents({
      ...base,
      pathogens: base.pathogens.map((p) => ({ ...p, hidden: p.id === "p1" })),
    });
    expect(battle.intents.map((i) => i.pathogenId)).toEqual(["p2"]);
  });

  it("never consume the resolution stream", () => {
    const states = run(42);
    for (const s of states)
      expect(s.rng.resolution).toEqual(states[0].rng.resolution);
    expect(states[1].rng.intents).not.toEqual(states[0].rng.intents);
  });
});

describe("resolveTurn", () => {
  it("is deterministic per seed", () => {
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });

  it("survives a JSON round-trip of every state and event list", () => {
    let battle = load(11);
    for (let t = 0; t < TURNS; t++) {
      const result = resolveTurn(battle, []);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      const reloaded = JSON.parse(JSON.stringify(battle)) as BattleState;
      expect(resolveTurn(reloaded, [])).toEqual(result);
      battle = result.state;
    }
  });

  it("treats hold as no order and rejects wallOff for now", () => {
    const battle = load(1);
    expect(resolveTurn(battle, [{ type: "hold", swarmId: "s1" }])).toEqual(
      resolveTurn(battle, []),
    );
    expect(() =>
      resolveTurn(battle, [{ type: "wallOff", swarmId: "s1" }]),
    ).toThrow(/not supported/);
    expect(() =>
      resolveTurn(battle, [
        { type: "hold", swarmId: "s1" },
        { type: "hold", swarmId: "s1" },
      ]),
    ).toThrow(/two orders/);
    expect(() =>
      resolveTurn(battle, [{ type: "hold", swarmId: "s9" }]),
    ).toThrow(/no swarm s9/);
  });

  it("blocks a spread onto a swarm and charges no cost", () => {
    const base = load(1);
    const battle: BattleState = {
      ...base,
      swarms: [
        { ...base.swarms[0], at: { x: 1, y: 3 } },
        ...base.swarms.slice(1),
      ],
      intents: [
        {
          type: "spread",
          pathogenId: "p1",
          to: { x: 1, y: 3 },
          size: 1,
          cost: 1,
        },
      ],
    };
    const { state, events } = resolveTurn(battle, []);
    expect(events).toEqual([
      {
        type: "Blocked",
        pathogenId: "p1",
        intent: "spread",
        at: { x: 1, y: 3 },
        swarmId: "s1",
      },
    ]);
    expect(state.pathogens).toEqual(base.pathogens);
    expect(state.nextId).toBe(base.nextId);
  });

  it("lets the first intent in order win a shared target and drops the other silently", () => {
    const base = load(1);
    const to = { x: 3, y: 2 };
    const battle: BattleState = {
      ...base,
      pathogens: [
        { ...base.pathogens[0], at: { x: 2, y: 2 } },
        { ...base.pathogens[1], size: 3, at: { x: 4, y: 5 } },
      ],
      intents: [
        { type: "spread", pathogenId: "p1", to, size: 1, cost: 0 },
        { type: "spore", pathogenId: "p2", to, size: 1, cost: 1 },
      ],
    };
    const { state, events } = resolveTurn(battle, []);
    expect(events.map((e) => e.type)).toEqual(["Spread"]);
    expect(state.pathogens.filter((p) => sameCoord(p.at, to))).toEqual([
      { id: "p3", kind: "strep", size: 1, at: to, hidden: false },
    ]);
    expect(state.pathogens.find((p) => p.id === "p2")?.size).toBe(3);
  });

  it("cancels the intent of a pathogen that is gone", () => {
    const base = load(1);
    const battle: BattleState = { ...base, pathogens: base.pathogens.slice(1) };
    const { events } = resolveTurn(battle, []);
    expect(
      events.every((e) => !("pathogenId" in e) || e.pathogenId !== "p1"),
    ).toBe(true);
  });
});
