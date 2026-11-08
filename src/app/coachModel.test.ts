import { describe, expect, it } from "vitest";
import { organismName } from "../sim/organisms";
import { resolveTurn } from "../sim/battle/resolve";
import { loadScenario, TUTORIAL_SEED } from "../sim/scenarios";
import type { BattleState, Order, SimEvent } from "../sim/types";
import {
  advanceCoach,
  coachMark,
  coachMode,
  dismissCoach,
  START_COACH,
  type CoachId,
  type CoachInput,
  type CoachState,
} from "./coachModel";
import { orderTargets, type OrderUi } from "./controller";
import type { TutorialPart } from "./tutorialModel";

const A = () => loadScenario("tutorial-a", TUTORIAL_SEED) as BattleState;
const B = () => loadScenario("tutorial-b", TUTORIAL_SEED) as BattleState;

const NO_UI: OrderUi = {
  orders: [],
  selected: null,
  charge: null,
  support: null,
};

const input = (
  part: TutorialPart,
  battle: BattleState,
  ui: Partial<OrderUi> = {},
  over: Partial<CoachInput> = {},
): CoachInput => ({
  part,
  battle,
  ui: { ...NO_UI, ...ui },
  mode: "planning",
  events: [],
  pointer: "tap",
  ...over,
});

const idOf = (s: CoachState, i: CoachInput) => coachMark(s, i)?.id ?? null;
const textOf = (s: CoachState, i: CoachInput) => coachMark(s, i)?.text ?? null;

/** A state in which these marks are finished. */
const doneState = (...done: CoachId[]): CoachState => ({
  ...START_COACH,
  done,
});

/** The orders that engulf the strep with s1 in the tutorial board. */
const engulfStrep = (b: BattleState): Order => {
  const t = orderTargets(b, { ...NO_UI, selected: "s1" })[0]!;
  return {
    type: "engulf",
    swarmId: "s1",
    pathogenId: t.pathogenId,
    from: t.from,
  };
};

/** Turn 1 played for real: s1 swallows the strep. */
const afterTurn1 = (start: BattleState) =>
  resolveTurn(start, [engulfStrep(start)]);

const SEALED_ENGULF: SimEvent = {
  type: "Engulfed",
  swarmId: "s2",
  pathogenId: "p1",
  wall: "sealed",
};
const LEAKY_ENGULF: SimEvent = {
  type: "Engulfed",
  swarmId: "s1",
  pathogenId: "p2",
  wall: "leaky",
};

describe("A1", () => {
  it("shows when part A starts, with Tap or Click as asked", () => {
    expect(textOf(START_COACH, input("a", A()))).toBe(
      "These are your cells, in swarms. Tap one to pick it.",
    );
    expect(textOf(START_COACH, input("a", A(), {}, { pointer: "click" }))).toBe(
      "These are your cells, in swarms. Click one to pick it.",
    );
  });
  it("is done once a swarm is selected, and stays done", () => {
    const sel = input("a", A(), { selected: "s1" });
    let s = advanceCoach(START_COACH, input("a", A()));
    expect(s.shownOn.A1).toBe(1);
    s = advanceCoach(s, sel);
    expect(s.done).toContain("A1");
    expect(idOf(s, input("a", A()))).not.toBe("A1");
  });
});

describe("A2 and A2b", () => {
  const s = doneState("A1");
  it("names the germ in reach when the picked swarm can swallow one", () => {
    const i = input("a", A(), { selected: "s1" });
    expect(textOf(s, i)).toBe(
      `Tap the ${organismName("strep")} to swallow it.`,
    );
  });
  it("points at the bright tiles when no germ is in reach", () => {
    const i = input("a", A(), { selected: "s3" });
    expect(textOf(s, i)).toBe(
      "The bright tiles show where it can go. Tap one to move closer.",
    );
  });
  it("does not show with no selection, or once the swarm has an order", () => {
    expect(idOf(s, input("a", A()))).toBeNull();
    const b = A();
    const i = input("a", b, { selected: "s1", orders: [engulfStrep(b)] });
    expect(idOf(s, i)).not.toBe("A2");
  });
  it("is done by a queued order, so A2b is done with it", () => {
    const b = A();
    let st = advanceCoach(s, input("a", b, { selected: "s3" }));
    expect(st.shownOn.A2).toBe(1);
    st = advanceCoach(
      st,
      input("a", b, {
        selected: "s3",
        orders: [{ type: "move", swarmId: "s3", to: { x: 5, y: 5 } }],
      }),
    );
    expect(st.done).toContain("A2");
    expect(idOf(st, input("a", b, { selected: "s1" }))).toBeNull();
  });
});

describe("A3", () => {
  const s = doneState("A1", "A2");
  it("shows when an order is queued, pointing at End Turn", () => {
    const b = A();
    const m = coachMark(s, input("a", b, { orders: [engulfStrep(b)] }));
    expect(m).toEqual({
      id: "A3",
      text: "Give the others orders too, or press End Turn. Everything moves at once.",
      target: "endTurn",
    });
  });
  it("does not show with no order", () => {
    expect(idOf(s, input("a", A()))).toBeNull();
  });
  it("is done when the turn ends", () => {
    const b = A();
    const queued = input("a", b, { orders: [engulfStrep(b)] });
    let st = advanceCoach(s, queued);
    expect(st.shownOn.A3).toBe(1);
    st = advanceCoach(st, input("a", afterTurn1(b).state));
    expect(st.done).toContain("A3");
  });
  it("is satisfied by ending turn 1 with no orders", () => {
    const next = resolveTurn(A(), []).state;
    const st = advanceCoach(doneState("A1"), input("a", next));
    expect(st.done).toContain("A3");
  });
});

describe("A4", () => {
  const s = doneState("A1", "A2", "A3");
  it("shows on turn 2 planning, with a prefix when a germ was killed", () => {
    const r = afterTurn1(A());
    expect(r.state.turn).toBe(2);
    const i = input("a", r.state, {}, { events: r.events });
    expect(textOf(s, i)).toBe(
      "Nice, your cells finished it. The arrows show what each germ will do next turn.",
    );
  });
  it("has no prefix when nothing was killed", () => {
    const r = resolveTurn(A(), []);
    const i = input("a", r.state, {}, { events: r.events });
    expect(textOf(s, i)).toBe(
      "The arrows show what each germ will do next turn.",
    );
  });
  it("does not show on turn 1, or after an order or Got it", () => {
    expect(idOf(s, input("a", A()))).toBeNull();
    const r = afterTurn1(A());
    let st = advanceCoach(s, input("a", r.state, {}, { events: r.events }));
    expect(st.shownOn.A4).toBe(2);
    expect(idOf(dismissCoach(st, "A4"), input("a", r.state))).toBeNull();
    st = advanceCoach(
      st,
      input("a", r.state, {
        orders: [{ type: "hold", swarmId: "s2" }],
      }),
    );
    expect(st.done).toContain("A4");
  });
});

describe("A5", () => {
  const s = doneState("A1", "A2", "A3");
  it("shows after a playback in which a shelled germ was swallowed, ahead of A4", () => {
    const r = afterTurn1(A());
    const i = input(
      "a",
      r.state,
      {},
      { events: [LEAKY_ENGULF, SEALED_ENGULF] },
    );
    expect(coachMark(s, i)).toMatchObject({
      id: "A5",
      text: "Swallowed, but not finished. Its shell keeps it alive inside your cells.",
    });
  });
  it("does not show when only a germ without a shell was swallowed", () => {
    const r = afterTurn1(A());
    const i = input("a", r.state, {}, { events: [LEAKY_ENGULF] });
    expect(idOf(s, i)).toBe("A4");
  });
  it("is done by Got it or an order, then A4 follows", () => {
    const r = afterTurn1(A());
    const i = input("a", r.state, {}, { events: [SEALED_ENGULF] });
    expect(idOf(dismissCoach(s, "A5"), i)).toBe("A4");
  });
});

describe("A5b", () => {
  const s = doneState("A1", "A2", "A3", "A4");
  const turn3 = () => {
    let b = A();
    for (let t = 1; t < 3; t++) b = resolveTurn(b, []).state;
    return b;
  };
  it("shows at the start of turn 3 if nothing shelled was swallowed", () => {
    expect(turn3().turn).toBe(3);
    expect(textOf(s, input("a", turn3()))).toBe(
      `The ${organismName("aspergillus")} has a shell. Try swallowing it and see what happens.`,
    );
  });
  it("does not show before turn 3", () => {
    expect(idOf(s, input("a", resolveTurn(A(), []).state))).toBeNull();
  });
  it("does not show once a shelled germ was swallowed, and is done by that", () => {
    expect(idOf(s, input("a", turn3(), {}, { events: [SEALED_ENGULF] }))).toBe(
      "A5",
    );
    expect(idOf({ ...s, swallowed: true }, input("a", turn3()))).toBeNull();
    let st = advanceCoach(s, input("a", turn3()));
    expect(st.shownOn.A5b).toBe(3);
    st = advanceCoach(st, input("a", turn3(), {}, { events: [SEALED_ENGULF] }));
    expect(st.done).toContain("A5b");
    expect(st.swallowed).toBe(true);
  });
  it("remembers a swallow from an earlier playback", () => {
    const st = advanceCoach(
      START_COACH,
      input("a", turn3(), {}, { events: [SEALED_ENGULF] }),
    );
    expect(st.swallowed).toBe(true);
    expect(
      idOf(doneState("A1", "A2", "A3", "A4", "A5"), input("a", turn3())),
    ).toBe("A5b");
    expect(
      idOf(
        { ...doneState("A1", "A2", "A3", "A4", "A5"), swallowed: true },
        input("a", turn3()),
      ),
    ).toBeNull();
  });
});

describe("B1", () => {
  it("shows when part B starts", () => {
    expect(textOf(START_COACH, input("b", B()))).toBe(
      "Now you take medicine every day. The green glow is your medicine, slowing germs down.",
    );
  });
  it("is done by a selection, and not shown again", () => {
    let st = advanceCoach(START_COACH, input("b", B()));
    st = advanceCoach(st, input("b", B(), { selected: "s1" }));
    expect(st.done).toContain("B1");
  });
  it("is done by Got it", () => {
    expect(idOf(dismissCoach(START_COACH, "B1"), input("b", B()))).toBe("B2");
  });
});

describe("B2", () => {
  const s = doneState("B1");
  it("shows once B1 is done and a charge is available, pointing at the chip", () => {
    expect(coachMark(s, input("b", B()))).toEqual({
      id: "B2",
      text: "Your medicine also gives you charges. Tap Antifungal.",
      target: "antifungal",
    });
  });
  it("does not show with no charges", () => {
    const b = B();
    const none = {
      ...b,
      meds: {
        ...b.meds,
        charges: { antibacterial: 0, antifungal: 0, strong: 0 },
      },
    };
    expect(idOf(s, input("b", none))).toBe("B3");
  });
  it("waits for B1", () => {
    expect(idOf(START_COACH, input("b", B()))).toBe("B1");
  });
  it("is done by picking any charge, the antibacterial too", () => {
    let st = advanceCoach(s, input("b", B()));
    expect(st.shownOn.B2).toBe(1);
    st = advanceCoach(st, input("b", B(), { charge: "antibacterial" }));
    expect(st.done).toContain("B2");
  });
});

describe("B2b", () => {
  const s = doneState("B1", "B2");
  it("shows when the antifungal is picked, naming the germ it can finish", () => {
    expect(textOf(s, input("b", B(), { charge: "antifungal" }))).toBe(
      `Now tap the green diamond on the ${organismName("aspergillus")}.`,
    );
  });
  it("does not show for the antibacterial or with no charge picked", () => {
    expect(idOf(s, input("b", B(), { charge: "antibacterial" }))).not.toBe(
      "B2b",
    );
    expect(idOf(s, input("b", B()))).not.toBe("B2b");
  });
  it("is done by a queued charge order", () => {
    const b = B();
    let st = advanceCoach(s, input("b", b, { charge: "antifungal" }));
    expect(st.shownOn.B2b).toBe(1);
    st = advanceCoach(
      st,
      input("b", b, {
        support: {
          type: "support",
          charge: "antifungal",
          target: "pathogen",
          pathogenId: "p1",
        },
      }),
    );
    expect(st.done).toContain("B2b");
  });
});

describe("B3", () => {
  const s = doneState("B1", "B2", "B2b");
  it("shows in the first planning phase with a stall mark", () => {
    expect(b3Stalled()).toBe(true);
    expect(textOf(s, input("b", B()))).toBe(
      "See the green pause sign? Your medicine is holding that germ back this turn.",
    );
  });
  it("does not show in part A, or with no stall mark", () => {
    expect(idOf(s, input("a", A()))).not.toBe("B3");
    const b = {
      ...B(),
      intents: B().intents.filter((x) => x.type !== "stall"),
    };
    expect(idOf(s, input("b", b))).toBeNull();
  });
  it("is done by Got it or the next turn", () => {
    const b = B();
    let st = advanceCoach(s, input("b", b));
    expect(st.shownOn.B3).toBe(1);
    expect(idOf(dismissCoach(st, "B3"), input("b", b))).toBeNull();
    st = advanceCoach(st, input("b", { ...b, turn: 2 }));
    expect(st.done).toContain("B3");
  });
});

function b3Stalled() {
  return B().intents.some((x) => x.type === "stall");
}

describe("B4", () => {
  const s = doneState("B1", "B2", "B3");
  const turn3 = () => {
    let b = B();
    for (let t = 1; t < 3; t++) b = resolveTurn(b, []).state;
    return b;
  };
  it("shows in the first planning phase with an incoming ring", () => {
    expect(textOf(s, input("b", turn3()))).toBe(
      "A ring at the edge means more germs are coming. A swarm standing on it meets them there.",
    );
  });
  it("does not show with no ring, or in part A", () => {
    expect(idOf(s, input("b", resolveTurn(B(), []).state))).toBeNull();
    expect(idOf(s, input("a", turn3()))).not.toBe("B4");
  });
  it("is done by Got it or the next turn", () => {
    let st = advanceCoach(s, input("b", turn3()));
    expect(st.shownOn.B4).toBe(3);
    st = advanceCoach(st, input("b", { ...turn3(), turn: 4 }));
    expect(st.done).toContain("B4");
  });
});

describe("B5", () => {
  const s = doneState("B1", "B2", "B3", "B4");
  it("shows after a playback in which a shelled germ was swallowed in part B", () => {
    const r = resolveTurn(B(), []);
    expect(
      textOf(s, input("b", r.state, {}, { events: [SEALED_ENGULF] })),
    ).toBe(
      "Swallowed. With your medicine, your cells have a better chance to finish it each turn.",
    );
  });
  it("does not show for a germ without a shell, or in part A", () => {
    const r = resolveTurn(B(), []);
    expect(
      idOf(s, input("b", r.state, {}, { events: [LEAKY_ENGULF] })),
    ).toBeNull();
    expect(
      idOf(
        doneState("A1", "A2", "A3", "A4", "A5b"),
        input("a", r.state, {}, { events: [SEALED_ENGULF] }),
      ),
    ).toBe("A5");
  });
  it("is done by Got it or an order", () => {
    const r = resolveTurn(B(), []);
    const i = input("b", r.state, {}, { events: [SEALED_ENGULF] });
    let st = advanceCoach(s, i);
    expect(st.shownOn.B5).toBe(2);
    st = advanceCoach(st, {
      ...i,
      ui: { ...NO_UI, orders: [{ type: "hold", swarmId: "s1" }] },
    });
    expect(st.done).toContain("B5");
    expect(idOf(dismissCoach(s, "B5"), i)).toBeNull();
  });
});

describe("the retire rule", () => {
  it("retires a mark after two turns on screen, and it never comes back", () => {
    let b = A();
    let st = advanceCoach(START_COACH, input("a", b));
    expect(idOf(st, input("a", b))).toBe("A1");
    b = resolveTurn(b, []).state; // turn 2: one turn on screen so far
    st = advanceCoach(st, input("a", b));
    expect(st.done).not.toContain("A1");
    b = resolveTurn(b, []).state; // turn 3: two turns have passed
    st = advanceCoach(st, input("a", b));
    expect(st.done).toContain("A1");
    expect(idOf(st, input("a", b))).not.toBe("A1");
  });
  it("counts a restarted fight's turns afresh", () => {
    const st = advanceCoach(
      { ...START_COACH, shownOn: { A1: 3 } },
      input("a", A()),
    );
    expect(st.shownOn.A1).toBe(1);
    expect(st.done).not.toContain("A1");
  });
  it("keeps finished marks finished across a restart", () => {
    const st = doneState("A1", "A2", "A3");
    expect(idOf(st, input("a", A()))).toBeNull();
  });
});

describe("part scoping", () => {
  it("part A never shows a B mark, and part B never shows an A mark", () => {
    const a = coachMark(START_COACH, input("a", A()));
    const b = coachMark(START_COACH, input("b", B()));
    expect(a?.id).toMatch(/^A/);
    expect(b?.id).toMatch(/^B/);
    const ids: CoachId[] = [];
    const st = START_COACH;
    for (const ui of [
      {},
      { selected: "s1" },
      { charge: "antifungal" as const },
    ]) {
      for (const [part, battle] of [
        ["a", A()],
        ["b", B()],
      ] as const) {
        const m = coachMark(st, input(part, battle, ui));
        if (m) ids.push(m.id);
        expect(m === null || m.id.startsWith(part.toUpperCase())).toBe(true);
      }
    }
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe("no mark while the turn plays or the fight is over", () => {
  it("is none in playback and over, in both parts", () => {
    for (const mode of ["playback", "over"] as const) {
      expect(coachMark(START_COACH, input("a", A(), {}, { mode }))).toBeNull();
      expect(coachMark(START_COACH, input("b", B(), {}, { mode }))).toBeNull();
    }
  });
  it("is back when planning resumes", () => {
    expect(idOf(START_COACH, input("a", A()))).toBe("A1");
  });
  it("records nothing while hidden", () => {
    const st = advanceCoach(
      START_COACH,
      input("a", A(), {}, { mode: "playback" }),
    );
    expect(st.shownOn).toEqual({});
  });
});

describe("the real tutorial boards", () => {
  it("part A turn 1 opens on A1, then A2 naming the strep, then A3 after the order", () => {
    const b = A();
    let st = advanceCoach(START_COACH, input("a", b));
    expect(coachMark(st, input("a", b))?.id).toBe("A1");
    const sel = input("a", b, { selected: "s1" });
    st = advanceCoach(st, sel);
    expect(coachMark(st, sel)).toMatchObject({
      id: "A2",
      text: `Tap the ${organismName("strep")} to swallow it.`,
    });
    const ordered = input("a", b, { selected: "s1", orders: [engulfStrep(b)] });
    st = advanceCoach(st, ordered);
    expect(coachMark(st, ordered)?.id).toBe("A3");
    const next = afterTurn1(b);
    const t2 = input("a", next.state, {}, { events: next.events });
    st = advanceCoach(st, t2);
    expect(coachMark(st, t2)?.text).toMatch(/^Nice, your cells finished it\./);
  });
  it("part B turn 1 opens on B1, then B2, then B2b, then B3 with the stalled mold", () => {
    const b = B();
    expect(
      b.intents.some((x) => x.type === "stall" && x.pathogenId === "p1"),
    ).toBe(true);
    let st = advanceCoach(START_COACH, input("b", b));
    expect(coachMark(st, input("b", b))?.id).toBe("B1");
    st = dismissCoach(st, "B1");
    expect(coachMark(st, input("b", b))?.id).toBe("B2");
    const picked = input("b", b, { charge: "antifungal" });
    st = advanceCoach(st, picked);
    expect(coachMark(st, picked)?.id).toBe("B2b");
    const queued = input("b", b, {
      support: {
        type: "support",
        charge: "antifungal",
        target: "pathogen",
        pathogenId: "p1",
      },
    });
    st = advanceCoach(st, queued);
    expect(coachMark(st, queued)?.id).toBe("B3");
  });
});

describe("coachMode", () => {
  it("is planning only when not playing and not over", () => {
    expect(coachMode(false, false)).toBe("planning");
    expect(coachMode(true, false)).toBe("playback");
    expect(coachMode(false, true)).toBe("over");
    expect(coachMode(true, true)).toBe("playback");
  });
});
