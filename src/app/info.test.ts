import { describe, expect, it } from "vitest";
import { telegraph } from "../sim/battle/intents";
import { loadScenario } from "../sim/scenarios";
import type { BattleState, Order } from "../sim/types";
import {
  endTurnHint,
  entityAt,
  heatKey,
  infoFor,
  orderCount,
  swarmStatuses,
} from "./info";

const battle = loadScenario("first-board", 1) as BattleState;

describe("swarmStatuses", () => {
  it("marks swarms without an order and counts them", () => {
    const orders: Order[] = [{ type: "hold", swarmId: "s1" }];
    const st = swarmStatuses(battle, orders, "s2");
    expect(st.map((s) => s.status)).toEqual(
      battle.swarms.map((s) => (s.id === "s1" ? "hold" : "none")),
    );
    expect(st.find((s) => s.swarmId === "s2")?.selected).toBe(true);
    const n = orderCount(st);
    expect(n.ordered).toBe(1);
    expect(n.total).toBe(battle.swarms.length);
    expect(n.holding).toBe(battle.swarms.length - 1);
  });

  it("calls a busy swarm busy, not idle", () => {
    const busy = {
      ...battle,
      swarms: battle.swarms.map((s, i) =>
        i === 0 ? { ...s, busyTurns: 1 } : s,
      ),
    };
    const st = swarmStatuses(busy, [], null);
    expect(st[0]?.status).toBe("busy");
    expect(orderCount(st).holding).toBe(battle.swarms.length - 1);
  });
});

describe("endTurnHint", () => {
  it("is quiet when everyone has an order", () => {
    expect(endTurnHint(0)).toBe("");
    expect(endTurnHint(1)).toBe("(1 swarm will hold)");
    expect(endTurnHint(2)).toBe("(2 swarms will hold)");
  });
});

describe("infoFor", () => {
  const marks = telegraph(battle, []);
  it("describes a pathogen with size and next action", () => {
    const p = battle.pathogens[0]!;
    const card = infoFor(battle, marks, { kind: "pathogen", id: p.id });
    expect(card?.lines[0]).toBe(`Size ${p.size}`);
    expect(card?.lines[1]).toMatch(/^Next turn: /);
  });

  it("describes a swarm with load and move range", () => {
    const card = infoFor(battle, marks, { kind: "swarm", id: "s1" });
    expect(card?.title).toBe("Swarm s1");
    expect(card?.lines.join(" ")).toMatch(/Moves up to \d+ tiles/);
  });

  it("returns null for a missing entity", () => {
    expect(infoFor(battle, marks, { kind: "swarm", id: "nope" })).toBeNull();
  });
});

describe("entityAt", () => {
  it("finds swarms and pathogens by tile", () => {
    expect(entityAt(battle, battle.swarms[0]!.at)).toEqual({
      kind: "swarm",
      id: battle.swarms[0]!.id,
    });
    expect(entityAt(battle, battle.pathogens[0]!.at)?.kind).toBe("pathogen");
    expect(entityAt(battle, { x: -1, y: -1 })).toBeNull();
  });
});

describe("heatKey", () => {
  it("lists only the levels on the board", () => {
    const k = heatKey(battle, 0);
    expect(k.forecast).toBe(false);
    for (const l of k.levels) expect([1, 2, 3]).toContain(l);
    expect(heatKey(battle, 2).forecast).toBe(true);
  });
});

describe("infoFor with medication", () => {
  const strep = battle.pathogens.find((p) => p.kind === "strep")!;
  const mark = (over: object) => [
    {
      pathogenId: strep.id,
      type: "grow" as const,
      from: strep.at,
      to: null,
      sizeAfter: strep.size,
      childSize: 0,
      blockedBy: null,
      cancelledBy: null,
      cancelledByCharge: null,
      ...over,
    },
  ];

  it("says a stalled germ is held back by medication", () => {
    const card = infoFor(battle, mark({ type: "stall" }), {
      kind: "pathogen",
      id: strep.id,
    });
    expect(card?.lines.join(" ")).toContain("Held back by medication");
    expect(card?.lines.join(" ")).not.toContain("grow");
  });

  it("says a charge cancels the arrow", () => {
    const card = infoFor(
      battle,
      mark({
        type: "spread",
        to: { x: 0, y: 0 },
        cancelledByCharge: "antibacterial",
      }),
      { kind: "pathogen", id: strep.id },
    );
    expect(card?.lines.join(" ")).toContain(
      "antibacterial dose kills it first",
    );
  });
});
