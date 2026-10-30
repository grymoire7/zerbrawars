import { describe, expect, it } from "vitest";
import { loadScenario } from "../sim/scenarios";
import type { BattleState } from "../sim/types";
import { createController, tapTile, type OrderUi } from "./controller";

const base = loadScenario("first-board", 1) as BattleState;
const loaded: BattleState = {
  ...base,
  swarms: base.swarms.map((s) =>
    s.id === "s3" ? { ...s, load: [{ kind: "aspergillus", size: 2 }] } : s,
  ),
};
const at = loaded.swarms[2]!.at;

describe("tapping the selected swarm's own tile", () => {
  it("cycles hold, wall off, clear for a loaded swarm", () => {
    let ui: OrderUi = { orders: [], selected: "s3" };
    const kinds: (string | undefined)[] = [];
    for (let i = 0; i < 3; i++) {
      ui = tapTile(loaded, ui, at);
      kinds.push(ui.orders[0]?.type);
    }
    expect(kinds).toEqual(["hold", "wallOff", undefined]);
  });

  it("keeps hold for an empty swarm", () => {
    let ui: OrderUi = { orders: [], selected: "s1" };
    const s1 = base.swarms[0]!.at;
    ui = tapTile(base, ui, s1);
    ui = tapTile(base, ui, s1);
    expect(ui.orders.map((o) => o.type)).toEqual(["hold"]);
  });
});

describe("controller", () => {
  it("queues wall off for the selected swarm and previews the heat", () => {
    const c = createController(
      () => loaded,
      () => {},
    );
    c.select("s3");
    expect(c.wallCard()?.queued).toBe(false);
    c.wallOff();
    expect(c.orders().map((o) => o.type)).toEqual(["wallOff"]);
    expect(c.wallCard()?.queued).toBe(true);
    expect(c.forecast()?.rising.some((r) => r.at.x === at.x)).toBe(true);
    c.wallOff();
    expect(c.orders()).toEqual([]);
  });

  it("ends the battle after the last turn and locks ordering", () => {
    const c = createController(
      () => loaded,
      () => {},
      { reducedMotion: true },
    );
    for (let i = 0; i < 12 && !c.over(); i++) c.endTurn();
    expect(c.over()).toBe(true);
    expect(c.outcome()).not.toBeNull();
    expect(c.canEndTurn()).toBe(false);
    c.select("s1");
    expect(c.selected()).toBeNull();
  });
});
