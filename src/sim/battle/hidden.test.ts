import { describe, expect, it } from "vitest";
import { isAdjacent, sameCoord } from "../board";
import type { Loadout } from "../life/loadout";
import { rngFromSeed } from "../rng";
import type { BattleState, Coord, Order, SimEvent } from "../types";
import { validateBattle } from "../validate";
import { BOTS } from "./bots";
import { telegraph } from "./intents";
import { orderProblems } from "./orders";
import { battleStatus } from "./outcome";
import { inflammationPreview, resolveTurn } from "./resolve";
import { battleFromLoadout } from "./setup";
import { supportProblem } from "./support";

// Rule: hidden tokens are invisible to validation and pathing. A moving swarm that steps next to
// one reveals it (Revealed) and stops on that tile, so it never ends on or passes through it.

const TOKEN: Coord = { x: 2, y: 5 };

function board(swarmAt?: Coord[]): BattleState {
  const loadout: Loadout = {
    schema: 1,
    scenario: "hidden",
    seed: 1,
    medLevel: 0,
    exposures: [{ kind: "strep", size: 2, at: { x: 1, y: 2 } }],
    load: 0,
    reservoirs: [{ kind: "aspergillus", size: 2, hidden: true, at: TOKEN }],
    doctorVisit: false,
    energy: 0,
    residualKillChance: 0,
  };
  const b = battleFromLoadout(loadout);
  if (!swarmAt) return b;
  return {
    ...b,
    swarms: b.swarms.map((s, i) => ({ ...s, at: swarmAt[i] })),
  };
}

const acts = (events: SimEvent[]) =>
  events.filter(
    (e) =>
      e.type === "SwarmMoved" || e.type === "Revealed" || e.type === "Engulfed",
  );

describe("hidden tokens", () => {
  it("start hidden with no intent", () => {
    const b = board();
    expect(b.pathogens[1]).toMatchObject({ id: "p2", hidden: true, at: TOKEN });
    expect(b.intents.map((i) => i.pathogenId)).toEqual(["p1"]);
  });

  it("stop a swarm that steps next to one, which reveals it", () => {
    const b = board();
    // s2 at 3,6 heads for 3,3; 3,5 is next to the token.
    const orders: Order[] = [
      { type: "move", swarmId: "s2", to: { x: 3, y: 3 } },
    ];
    expect(orderProblems(b, orders)).toEqual([]);
    const { state, events } = resolveTurn(b, orders);
    expect(acts(events)).toEqual([
      {
        type: "SwarmMoved",
        swarmId: "s2",
        path: [
          { x: 3, y: 6 },
          { x: 3, y: 5 },
        ],
      },
      {
        type: "Revealed",
        pathogenId: "p2",
        at: TOKEN,
        kind: "aspergillus",
        size: 2,
        swarmId: "s2",
      },
    ]);
    expect(state.swarms[1].at).toEqual({ x: 3, y: 5 });
    expect(state.pathogens[1].hidden).toBe(false);
    // Visible now: it telegraphs from the next turn and can be engulfed.
    expect(state.intents.map((i) => i.pathogenId)).toContain("p2");
    expect(validateBattle(state)).toEqual([]);
  });

  it("let a move aimed through the token's tile validate, then stop short of it", () => {
    const b = board([
      { x: 2, y: 3 },
      { x: 3, y: 6 },
      { x: 5, y: 6 },
    ]);
    const orders: Order[] = [
      { type: "move", swarmId: "s1", to: { x: 2, y: 6 } },
    ];
    expect(orderProblems(b, orders)).toEqual([]);
    const { state } = resolveTurn(b, orders);
    // 2,4 is next to the token, so s1 stops there and never enters 2,5.
    expect(state.swarms[0].at).toEqual({ x: 2, y: 4 });
    expect(validateBattle(state)).toEqual([]);
  });

  it("back a swarm up when its stop tile is another swarm's destination", () => {
    const b = board([
      { x: 0, y: 6 },
      { x: 4, y: 6 },
      { x: 6, y: 6 },
    ]);
    const orders: Order[] = [
      { type: "move", swarmId: "s1", to: { x: 3, y: 6 } },
      { type: "move", swarmId: "s2", to: { x: 2, y: 6 } },
    ];
    expect(orderProblems(b, orders)).toEqual([]);
    const { state, events } = resolveTurn(b, orders);
    expect(state.swarms[0].at).toEqual({ x: 1, y: 6 });
    expect(state.swarms[1].at).toEqual({ x: 2, y: 6 });
    // Revealed once, by the first swarm to notice.
    expect(events.filter((e) => e.type === "Revealed")).toHaveLength(1);
    expect(validateBattle(state)).toEqual([]);
  });

  it("make an engulf whose approach is cut short fizzle", () => {
    // s1 from 1,6 to 1,3 to engulf p1 at 1,2; with the token at 2,4, it stops at 1,4.
    const b = {
      ...board(),
      pathogens: board().pathogens.map((p) =>
        p.id === "p2" ? { ...p, at: { x: 2, y: 4 } } : p,
      ),
    };
    const orders: Order[] = [
      { type: "engulf", swarmId: "s1", pathogenId: "p1", from: { x: 1, y: 3 } },
    ];
    expect(orderProblems(b, orders)).toEqual([]);
    const { state, events } = resolveTurn(b, orders);
    expect(state.swarms[0].at).toEqual({ x: 1, y: 4 });
    expect(events.some((e) => e.type === "Engulfed")).toBe(false);
    expect(state.pathogens.map((p) => p.id)).toContain("p1");
  });

  it("never leak through validation reasons or previews", () => {
    const b = board();
    const gone = { ...b, pathogens: b.pathogens.filter((p) => p.id !== "p2") };
    const engulf = (pathogenId: string): Order => ({
      type: "engulf",
      swarmId: "s1",
      pathogenId,
      from: null,
    });
    expect(orderProblems(b, [engulf("p2")])).toEqual(["no pathogen p2"]);
    expect(orderProblems(b, [engulf("p9")])).toEqual(["no pathogen p9"]);
    expect(
      supportProblem(b, [], {
        type: "support",
        charge: "antifungal",
        target: "pathogen",
        pathogenId: "p2",
      }),
    ).toBe("no antifungal charge left");
    const charged = {
      ...b,
      meds: {
        ...b.meds,
        charges: { antibacterial: 0, antifungal: 1, strong: 0 },
      },
    };
    expect(
      supportProblem(charged, [], {
        type: "support",
        charge: "antifungal",
        target: "pathogen",
        pathogenId: "p2",
      }),
    ).toBe("no pathogen p2");
    const orders: Order[] = [
      { type: "move", swarmId: "s2", to: { x: 3, y: 3 } },
    ];
    expect(orderProblems(b, orders)).toEqual(orderProblems(gone, orders));
    expect(telegraph(b, orders)).toEqual(telegraph(gone, orders));
    expect(inflammationPreview(b, orders)).toEqual(
      inflammationPreview(gone, orders),
    );
  });

  it("never overlap anything over many random battles", () => {
    for (let seed = 1; seed <= 150; seed++) {
      let battle = battleFromLoadout({
        schema: 1,
        scenario: "fuzz",
        seed,
        medLevel: 0.5,
        exposures: [
          { kind: "strep", size: 2 },
          { kind: "aspergillus", size: 3 },
        ],
        load: 0,
        reservoirs: [
          { kind: "aspergillus", size: 2, hidden: true },
          { kind: "aspergillus", size: 1, hidden: true },
        ],
        doctorVisit: false,
        energy: 0,
      });
      const rng = { state: rngFromSeed(seed) };
      for (let t = 0; t < 6 && !battleStatus(battle).over; t++) {
        let orders: Order[] = [];
        for (const swarm of battle.swarms) {
          const o = BOTS.random({ battle, swarm, orders, rng });
          if (o && orderProblems(battle, [...orders, o]).length === 0)
            orders = [...orders, o];
        }
        const r = resolveTurn(battle, orders);
        expect(validateBattle(r.state)).toEqual([]);
        for (const s of r.state.swarms) {
          for (const p of r.state.pathogens.filter((q) => q.hidden)) {
            expect(sameCoord(s.at, p.at)).toBe(false);
            expect(isAdjacent(s.at, p.at)).toBe(false);
          }
        }
        battle = r.state;
      }
    }
  });
});
