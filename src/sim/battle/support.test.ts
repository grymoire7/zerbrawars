import { describe, expect, it } from "vitest";
import { duelLoadout, firstBoardLoadout } from "../scenarios";
import type { BattleState, Order, SupportOrder } from "../types";
import { validateBattle } from "../validate";
import { telegraph } from "./intents";
import { inflammationPreview, resolveTurn, turnProblems } from "./resolve";
import { battleFromLoadout } from "./setup";
import {
  availableCharges,
  chargeCovers,
  supportPreview,
  supportProblem,
  supportTargets,
} from "./support";

// Duel at full meds: p1 strep (leaky) size 2 at 1,2; p2 aspergillus (sealed) size 2 at 5,2.
// Charges: 1 antibacterial, 2 antifungal.

function duel(seed = 1): BattleState {
  return { ...battleFromLoadout(duelLoadout(seed)), residualKillChance: 0 };
}

const kill = (
  charge: SupportOrder["charge"],
  pathogenId: string,
): SupportOrder => ({
  type: "support",
  charge,
  target: "pathogen",
  pathogenId,
});
const clear = (
  charge: SupportOrder["charge"],
  swarmId: string,
): SupportOrder => ({ type: "support", charge, target: "load", swarmId });
const engulfP2: Order = {
  type: "engulf",
  swarmId: "s3",
  pathogenId: "p2",
  from: { x: 5, y: 3 },
};

/** Duel with s3 already carrying the mold (size 2). */
function loaded(): BattleState {
  const b = duel();
  return {
    ...b,
    swarms: b.swarms.map((s) =>
      s.id === "s3" ? { ...s, load: [{ kind: "aspergillus", size: 2 }] } : s,
    ),
    pathogens: b.pathogens.filter((p) => p.id !== "p2"),
    intents: b.intents.filter((i) => i.pathogenId !== "p2"),
  };
}

describe("charge coverage", () => {
  it("goes by growth form: antibacterial for bacteria, antifungal for molds", () => {
    expect(chargeCovers("antibacterial", "strep")).toBe(true);
    expect(chargeCovers("antibacterial", "aspergillus")).toBe(false);
    expect(chargeCovers("antifungal", "aspergillus")).toBe(true);
    expect(chargeCovers("antifungal", "strep")).toBe(false);
    expect(chargeCovers("strong", "strep")).toBe(true);
    expect(chargeCovers("strong", "aspergillus")).toBe(true);
  });
});

describe("supportProblem", () => {
  const b = duel();

  it("accepts a covered, small, visible target anywhere on the board", () => {
    expect(supportProblem(b, [], kill("antibacterial", "p1"))).toBeNull();
    expect(supportProblem(b, [], kill("antifungal", "p2"))).toBeNull();
  });

  it("explains every rejection", () => {
    expect(supportProblem(b, [], kill("strong", "p1"))).toBe(
      "no strong charge left",
    );
    expect(supportProblem(b, [], kill("antifungal", "p1"))).toBe(
      "antifungal does not work on Streptococcus p1",
    );
    expect(supportProblem(b, [], kill("antibacterial", "p9"))).toBe(
      "no pathogen p9",
    );
    const big = {
      ...b,
      pathogens: b.pathogens.map((p) =>
        p.id === "p2" ? { ...p, size: 3 } : p,
      ),
    };
    expect(supportProblem(big, [], kill("antifungal", "p2"))).toBe(
      "p2 is too big for antifungal (size 3, max 2)",
    );
    expect(supportProblem(b, [engulfP2], kill("antifungal", "p2"))).toBe(
      "s3 is already engulfing p2",
    );
    expect(supportProblem(b, [], clear("antifungal", "s1"))).toBe(
      "s1 carries nothing",
    );
    expect(supportProblem(b, [], clear("antifungal", "s9"))).toBe(
      "no swarm s9",
    );
    const l = loaded();
    expect(supportProblem(l, [], clear("antifungal", "s3"))).toBeNull();
    expect(supportProblem(l, [], clear("antibacterial", "s3"))).toBe(
      "antibacterial cannot clear what s3 carries",
    );
    expect(
      supportProblem(
        l,
        [{ type: "wallOff", swarmId: "s3" }],
        clear("antifungal", "s3"),
      ),
    ).toBe("s3 is walling off");
    const spent = {
      ...b,
      meds: {
        ...b.meds,
        charges: { antibacterial: 0, antifungal: 0, strong: 0 },
      },
    };
    expect(supportProblem(spent, [], kill("antibacterial", "p1"))).toBe(
      "no antibacterial charge left",
    );
  });

  it("makes resolveTurn throw on an invalid support, listing it with order problems", () => {
    expect(
      turnProblems(b, [{ type: "hold", swarmId: "s9" }], kill("strong", "p1")),
    ).toEqual(["no swarm s9", "no strong charge left"]);
    expect(() => resolveTurn(b, [], kill("antifungal", "p1"))).toThrow(
      /antifungal does not work on Streptococcus p1/,
    );
  });
});

describe("resolving a support charge", () => {
  it("kills the pathogen before it acts, cancels its intent and spends the charge", () => {
    const b = duel();
    const { state, events } = resolveTurn(b, [], kill("antifungal", "p2"));
    expect(events.slice(0, 2)).toEqual([
      {
        type: "SupportUsed",
        charge: "antifungal",
        target: "pathogen",
        at: { x: 5, y: 2 },
        pathogenId: "p2",
        swarmId: null,
      },
      { type: "Killed", pathogenId: "p2", at: { x: 5, y: 2 }, cause: "charge" },
    ]);
    expect(
      events.some(
        (e) =>
          "pathogenId" in e &&
          e.pathogenId === "p2" &&
          e.type !== "SupportUsed" &&
          e.type !== "Killed",
      ),
    ).toBe(false);
    expect(state.pathogens.map((p) => p.id)).toEqual(
      expect.not.arrayContaining(["p2"]),
    );
    expect(state.meds.charges).toEqual({
      antibacterial: 1,
      antifungal: 1,
      strong: 0,
    });
    expect(validateBattle(state)).toEqual([]);
  });

  it("resolves alongside engulfs, after moves", () => {
    const b = duel();
    const orders: Order[] = [
      { type: "engulf", swarmId: "s1", pathogenId: "p1", from: { x: 1, y: 3 } },
    ];
    const { events, status } = resolveTurn(b, orders, kill("antifungal", "p2"));
    expect(events.map((e) => e.type).slice(0, 5)).toEqual([
      "SwarmMoved",
      "SupportUsed",
      "Killed",
      "Engulfed",
      "Killed",
    ]);
    // Both pathogens gone, nothing carried: cleared with no dice.
    expect(status.reason).toBe("noFreePathogens");
  });

  it("clears the oldest carried load it can, and the rest still rolls", () => {
    const b = loaded();
    const two = {
      ...b,
      residualKillChance: 1,
      swarms: b.swarms.map((s) =>
        s.id === "s3"
          ? {
              ...s,
              load: [
                { kind: "aspergillus" as const, size: 3 },
                { kind: "aspergillus" as const, size: 1 },
              ],
            }
          : s,
      ),
    };
    const { state, events } = resolveTurn(two, [], clear("antifungal", "s3"));
    expect(events.slice(0, 2)).toEqual([
      {
        type: "SupportUsed",
        charge: "antifungal",
        target: "load",
        at: { x: 5, y: 6 },
        pathogenId: null,
        swarmId: "s3",
      },
      {
        type: "Loaded",
        swarmId: "s3",
        load: [{ kind: "aspergillus", size: 3 }],
      },
    ]);
    // The size-3 load was too big for the charge; it gets its carried roll (100% here).
    expect(events.filter((e) => e.type === "ResidualKill")).toHaveLength(1);
    expect(state.swarms[2].load).toEqual([]);
  });

  it("leaves a cleared swarm empty with no carried roll", () => {
    const { state, events } = resolveTurn(
      loaded(),
      [],
      clear("antifungal", "s3"),
    );
    expect(state.swarms[2].load).toEqual([]);
    expect(events.some((e) => e.type === "ResidualKill")).toBe(false);
    expect(validateBattle(state)).toEqual([]);
  });

  it("is deterministic and survives a JSON round-trip", () => {
    const b = duel(5);
    const support = kill("antibacterial", "p1");
    const r = resolveTurn(b, [], support);
    expect(resolveTurn(b, [], support)).toEqual(r);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
    const reloaded = JSON.parse(JSON.stringify(b)) as BattleState;
    expect(resolveTurn(reloaded, [], support)).toEqual(r);
  });
});

describe("support previews", () => {
  it("telegraph marks a charged pathogen's intent as cancelled", () => {
    const b = duel();
    const marks = telegraph(b, [], kill("antifungal", "p2"));
    expect(marks.find((m) => m.pathogenId === "p2")?.cancelledByCharge).toBe(
      "antifungal",
    );
    expect(
      marks.find((m) => m.pathogenId === "p1")?.cancelledByCharge,
    ).toBeNull();
    // An invalid support cancels nothing.
    expect(
      telegraph(b, [], kill("antifungal", "p1")).every(
        (m) => m.cancelledByCharge === null,
      ),
    ).toBe(true);
  });

  it("supportPreview describes the kill or the cleared load", () => {
    const b = duel();
    expect(supportPreview(b, [], kill("antifungal", "p2"))).toEqual({
      reason: null,
      charge: "antifungal",
      chargesLeft: 1,
      at: { x: 5, y: 2 },
      kills: { kind: "aspergillus", size: 2 },
      cancels: b.intents.find((i) => i.pathogenId === "p2"),
      loadAfter: null,
      moveRangeAfter: null,
    });
    expect(
      supportPreview(b, [engulfP2], kill("antifungal", "p2"))?.reason,
    ).toBe("s3 is already engulfing p2");
    expect(
      supportPreview(loaded(), [], clear("antifungal", "s3")),
    ).toMatchObject({
      reason: null,
      kills: { kind: "aspergillus", size: 2 },
      loadAfter: [],
      moveRangeAfter: 3,
    });
    expect(supportPreview(b, [], kill("antifungal", "p9"))).toBeNull();
    expect(supportPreview(b, [], clear("antifungal", "s1"))).toBeNull();
  });

  it("supportTargets lists every legal use, minus pathogens being engulfed", () => {
    const b = duel();
    expect(availableCharges(b)).toEqual(["antibacterial", "antifungal"]);
    expect(supportTargets(b, [], "antibacterial").map((t) => t.order)).toEqual([
      kill("antibacterial", "p1"),
    ]);
    expect(supportTargets(b, [], "antifungal").map((t) => t.at)).toEqual([
      { x: 5, y: 2 },
    ]);
    expect(supportTargets(b, [engulfP2], "antifungal")).toEqual([]);
    expect(
      supportTargets(loaded(), [], "antifungal").map((t) => t.order),
    ).toEqual([clear("antifungal", "s3")]);
    expect(supportTargets(b, [], "strong")).toEqual([]);
  });

  it("inflammationPreview counts the charged pathogen as gone", () => {
    const b = duel();
    const with_ = inflammationPreview(b, [], kill("antifungal", "p2"));
    const without = inflammationPreview(b);
    const at = (p: typeof with_) =>
      p.rising.some((h) => h.at.x === 5 && h.at.y === 2);
    expect(at(without)).toBe(true);
    expect(at(with_)).toBe(false);
  });
});

describe("first-board at full meds", () => {
  it("cannot charge the mold until it shrinks below spore size", () => {
    const b = battleFromLoadout(firstBoardLoadout(1));
    expect(supportProblem(b, [], kill("antifungal", "p2"))).toMatch(/too big/);
  });
});
