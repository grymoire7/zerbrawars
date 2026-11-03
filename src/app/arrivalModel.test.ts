import { describe, expect, it } from "vitest";
import { telegraph } from "../sim/battle/intents";
import { battleFromLoadout } from "../sim/battle/setup";
import { duelLoadout } from "../sim/scenarios";
import type { Arrival, BattleState, Coord } from "../sim/types";
import {
  arrivalBonus,
  arrivalCard,
  arrivalMarkModel,
  incomingKey,
  nextArrival,
  turnText,
} from "./arrivalModel";
import { entityAt, infoFor } from "./info";

const DOOR: Coord = { x: 3, y: 0 };
const arr = (
  turn: number,
  kind: Arrival["kind"] = "staph",
  size = 2,
  door: Coord = DOOR,
): Arrival => ({ turn, kind, size, door });

function make(arrivals: Arrival[], turn = 1, missed = 0): BattleState {
  const b = battleFromLoadout({ ...duelLoadout(1), arrivals });
  return { ...b, turn, missedDoses: missed };
}

describe("nextArrival", () => {
  it("says nothing when no group is left", () => {
    expect(nextArrival(make([])).text).toBe("Next: nothing");
  });

  it("names the soonest group and its turn", () => {
    const n = nextArrival(make([arr(3), arr(5, "strep")]));
    expect(n.text).toBe("Next: 1 Staph, turn 3");
    expect(n.aria).toContain("Staphylococcus");
  });

  it("joins a mixed group and says this turn when it is due now", () => {
    const b = make([arr(2, "strep", 1, { x: 1, y: 0 }), arr(2)], 2);
    expect(nextArrival(b).text).toBe("Next: 1 Strep + 1 Staph, this turn");
  });
});

describe("turnText", () => {
  it("reads Turn N of M, with a skirmish prefix", () => {
    expect(turnText({ turn: 3, maxTurns: 6, kind: "full" }).text).toBe(
      "Turn 3 of 6",
    );
    expect(turnText({ turn: 2, maxTurns: 4, kind: "skirmish" }).text).toBe(
      "Skirmish · Turn 2 of 4",
    );
    expect(turnText({ turn: 9, maxTurns: 6, kind: "full" }).aria).toBe(
      "turn 6 of 6",
    );
  });
});

describe("the incoming mark", () => {
  const marks = (b: BattleState) =>
    telegraph(b).filter((m) => m.type === "arrive");

  it("shows only arrivals that are due, with name and size", () => {
    const b = make([arr(1), arr(4)]);
    const [m] = marks(b);
    expect(marks(b)).toHaveLength(1);
    const model = arrivalMarkModel(b, m!)!;
    expect(model.badge).toBe("Staph 2");
    expect(model.caption).toBe("arrives");
    expect(model.blocked).toBe(false);
    expect(incomingKey(b)).toEqual({ incoming: true, blocked: false });
  });

  it("flags missed-dose growth and a blocked door", () => {
    const b = make([arr(1, "strep", 3)], 1, 1);
    const onDoor = {
      ...b,
      swarms: b.swarms.map((s, i) => (i === 0 ? { ...s, at: DOOR } : s)),
    };
    expect(arrivalBonus(b, b.arrivals[0]!)).toBe(1);
    const model = arrivalMarkModel(onDoor, marks(onDoor)[0]!)!;
    expect(model.badge).toBe("Strep 3 +1");
    expect(model.blocked).toBe(true);
    expect(model.caption).toBe("blocked");
    expect(incomingKey(onDoor).blocked).toBe(true);
  });

  it("caps the bonus at what the size can hold", () => {
    const b = make([arr(1, "strep", 1)], 1, 3);
    expect(arrivalBonus(b, b.arrivals[0]!)).toBe(0);
  });

  it("is tappable and explained in plain, non-blaming words", () => {
    const b = make([arr(1, "staph", 3)], 1, 1);
    expect(entityAt(b, DOOR)).toEqual({ kind: "arrival", id: "arrive:0" });
    const card = infoFor(b, telegraph(b), { kind: "arrival", id: "arrive:0" })!;
    expect(card.title).toBe("Incoming bacteria");
    expect(card.lines).toContain("Size 3");
    expect(card.lines.join(" ")).toContain("+1 size from missed doses");
    expect(card.lines.join(" ")).not.toMatch(/fault|should have|mistake/i);
    expect(arrivalCard(b, marks(b)[0]!)?.sub).toContain("Staphylococcus");
  });

  it("says a leaky group is cleared and a sealed one tries again", () => {
    const stand = (kind: Arrival["kind"]) => {
      const b = make([arr(1, kind)]);
      const s = {
        ...b,
        swarms: b.swarms.map((w, i) => (i === 0 ? { ...w, at: DOOR } : w)),
      };
      return arrivalCard(s, marks(s)[0]!)!.lines.join(" ");
    };
    expect(stand("strep")).toContain("cleared");
    expect(stand("staph")).toContain("tries again");
  });
});
