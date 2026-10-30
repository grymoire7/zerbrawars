import { describe, expect, it } from "vitest";
import { loadScenario } from "../sim/scenarios";
import type { BattleState } from "../sim/types";
import {
  createController,
  describeEvent,
  supportCardFor,
  tapTile,
  type OrderUi,
} from "./controller";

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
    let ui: OrderUi = {
      orders: [],
      selected: "s3",
      charge: null,
      support: null,
    };
    const kinds: (string | undefined)[] = [];
    for (let i = 0; i < 3; i++) {
      ui = tapTile(loaded, ui, at);
      kinds.push(ui.orders[0]?.type);
    }
    expect(kinds).toEqual(["hold", "wallOff", undefined]);
  });

  it("keeps hold for an empty swarm", () => {
    let ui: OrderUi = {
      orders: [],
      selected: "s1",
      charge: null,
      support: null,
    };
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

describe("support orders", () => {
  const make = () =>
    createController(
      () => base,
      () => {},
      { reducedMotion: true },
    );

  it("picks a charge, queues a dose on a target tap and replaces it with another", () => {
    const c = make();
    expect(c.charges().map((x) => x.charge)).toEqual([
      "antibacterial",
      "antifungal",
    ]);
    c.pickCharge("antibacterial");
    const p1 = base.pathogens[0]!.at;
    expect(c.dose().targets).toContainEqual(p1);
    c.tap(p1);
    expect(c.supportOrder()).toMatchObject({
      charge: "antibacterial",
      pathogenId: "p1",
    });
    expect(c.dose().queued).toEqual(p1);
    c.pickCharge("antibacterial");
    c.tap(base.pathogens[3]!.at);
    expect(c.supportOrder()).toMatchObject({
      charge: "antibacterial",
      pathogenId: "p4",
    });
    c.clearSupport();
    expect(c.supportOrder()).toBeNull();
  });

  it("puts the charge back when the tap is not a target", () => {
    const c = make();
    c.pickCharge("antifungal");
    c.tap(base.swarms[0]!.at);
    expect(c.supportOrder()).toBeNull();
    expect(c.charges().every((x) => !x.selected)).toBe(true);
    expect(c.selected()).toBe("s1");
  });

  it("resolves the dose with the turn and spends the charge", () => {
    const c = make();
    c.pickCharge("antibacterial");
    c.tap(base.pathogens[0]!.at);
    c.endTurn();
    expect(c.state().pathogens.some((p) => p.id === "p1")).toBe(false);
    expect(c.state().meds.charges.antibacterial).toBe(0);
    expect(c.supportOrder()).toBeNull();
  });

  it("refuses an end turn whose dose is invalid and says why", () => {
    const c = make();
    c.pickCharge("antibacterial");
    c.tap(base.pathogens[0]!.at);
    c.select("s1");
    c.tap({ x: 1, y: 3 });
    c.tap(base.pathogens[0]!.at);
    c.endTurn();
    expect(c.problems().some((t) => t.includes("engulfing"))).toBe(true);
    expect(c.state().turn).toBe(1);
  });

  it("describes the card and the log lines", () => {
    const card = supportCardFor(
      base,
      [],
      {
        type: "support",
        charge: "antibacterial",
        target: "pathogen",
        pathogenId: "p1",
      },
      false,
    );
    expect(card?.text).toContain("Kills it, no dice.");
    expect(
      describeEvent({
        type: "SupportUsed",
        charge: "antifungal",
        target: "pathogen",
        at: { x: 1, y: 1 },
        pathogenId: "p2",
        swarmId: null,
      }),
    ).toContain("antifungal");
    expect(
      describeEvent({
        type: "Revealed",
        pathogenId: "p5",
        at: { x: 1, y: 1 },
        kind: "strep",
        size: 2,
        swarmId: "s1",
      }),
    ).toContain("revealed");
  });
});
