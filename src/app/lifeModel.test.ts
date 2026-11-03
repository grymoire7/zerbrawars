import { describe, expect, it } from "vitest";
import {
  advanceDay,
  createLife,
  placeCard,
  setDose,
} from "../sim/life/calendar";
import type { LifeState } from "../sim/life/types";
import {
  doseStrip,
  friendlyProblem,
  lifeBeats,
  NO_PENDING,
  oddsText,
  selectActivity,
  tapActivity,
  tapSlot,
  clearPending,
  particleCount,
  placementCheck,
  weekPlayStops,
  weekSummary,
  battleOddsText,
  weekEndText,
  lifeStatusModel,
  chargesText,
  medStateWord,
} from "./lifeModel";

const put = (
  l: LifeState,
  d: number,
  s: number,
  c: Parameters<typeof placeCard>[3],
  p = false,
) => placeCard(l, d, s, c, p).state;

describe("oddsText", () => {
  it("states the chance in words", () => {
    expect(oddsText(0.45, "aspergillus")).toBe("45% chance of a mold exposure");
    expect(oddsText(0.15, "strep")).toBe("15% chance of a bacterial exposure");
  });
});

describe("particleCount", () => {
  it("scales with expected pathogens, so the smarter version brings fewer", () => {
    expect(particleCount(0.9)).toBeGreaterThan(particleCount(0.15));
    expect(particleCount(0)).toBe(0);
    expect(particleCount(0.001)).toBe(1);
    expect(particleCount(50)).toBeLessThanOrEqual(40);
  });
});

describe("friendlyProblem", () => {
  it("rewords sim problems and passes unknown ones through", () => {
    expect(friendlyProblem("not enough energy")).toMatch(/energy/);
    expect(friendlyProblem("lake is already on day 1")).toBe(
      "Already planned for day 2",
    );
    expect(friendlyProblem("odd")).toBe("odd");
  });
});

describe("placementCheck", () => {
  it("lets a planned card move, and blocks a sleepover on the last day", () => {
    let l = createLife({ seed: 1 });
    l = put(l, 0, 0, "band");
    expect(placementCheck(l, 1, 0, "band", false).ok).toBe(true);
    const bad = placementCheck(l, 2, 1, "sleepover", false);
    expect(bad.ok).toBe(false);
    expect(bad.reasons[0]).toMatch(/sleepover/i);
  });
});

describe("doseStrip", () => {
  it("shows the friction day lost with its reason", () => {
    let l = createLife({ seed: 1 });
    l = put(l, 0, 1, "sleepover", false);
    const strip = doseStrip(l);
    expect(strip).toHaveLength(3);
    expect(strip[1]).toMatchObject({
      taken: false,
      why: "pills in the other bag",
    });
    expect(strip[2].level).toBeLessThan(1);
    expect(strip.map((c) => c.toggle)).toEqual([true, false, true]);
  });

  it("follows the toggles with a word, a level and which chips can be tapped", () => {
    let l = createLife({ seed: 1 });
    expect(doseStrip(l).map((c) => c.why)).toEqual(["taken", "taken", "taken"]);
    l = setDose(l, 2, false).state;
    let strip = doseStrip(l);
    expect(strip.map((c) => c.taken)).toEqual([true, true, false]);
    expect(strip[2]).toMatchObject({ why: "skipped", toggle: true });
    expect(strip[2].level).toBeCloseTo(2 / 3);
    l = setDose(l, 2, true).state;
    strip = doseStrip(l);
    expect(strip.map((c) => c.taken)).toEqual([true, true, true]);
    expect(strip[2].level).toBe(1);
    // A played day shows what happened and no longer toggles.
    l = advanceDay(setDose(l, 1, false).state).state;
    strip = doseStrip(l);
    expect(strip.map((c) => c.toggle)).toEqual([false, true, true]);
    expect(strip[1]).toMatchObject({ taken: false, why: "skipped" });
  });
});

describe("lifeBeats and weekSummary", () => {
  it("narrates a day and sums the week", () => {
    let l = createLife({ seed: 3 });
    l = put(l, 0, 0, "lake");
    const step = advanceDay(l);
    const lines = lifeBeats(step.events);
    expect(lines.some((t) => t.includes("The lake with Jordan"))).toBe(true);
    expect(lines.some((t) => /chance/.test(t))).toBe(true);
    const s = weekSummary(step.state);
    expect(s.points).toBe(5);
    expect(s.dodged + s.landed.length).toBe(1);
  });
});

describe("pending pick", () => {
  it("activity first, then a slot, places it", () => {
    const a = tapActivity(NO_PENDING, "dinner");
    expect(a.pending).toEqual({ activity: "dinner", slot: null });
    const b = tapSlot(a.pending, 1, 0, null);
    expect(b.effect).toEqual({
      type: "place",
      activity: "dinner",
      day: 1,
      slot: 0,
    });
    expect(b.pending).toEqual(NO_PENDING);
  });

  it("slot first highlights it, then an activity places it", () => {
    const a = tapSlot(NO_PENDING, 2, 1, null);
    expect(a.pending.slot).toEqual({ day: 2, slot: 1 });
    expect(a.effect).toBeNull();
    const b = tapActivity(a.pending, "dinner");
    expect(b.effect).toEqual({
      type: "place",
      activity: "dinner",
      day: 2,
      slot: 1,
    });
    expect(b.pending).toEqual(NO_PENDING);
  });

  it("tapping the chosen slot or activity again unselects", () => {
    const s = tapSlot(NO_PENDING, 0, 0, null).pending;
    expect(tapSlot(s, 0, 0, null).pending).toEqual(NO_PENDING);
    const a = tapActivity(NO_PENDING, "dinner").pending;
    expect(tapActivity(a, "dinner").pending).toEqual(NO_PENDING);
  });

  it("tapping a placed activity with nothing picked takes it off", () => {
    const r = tapSlot(NO_PENDING, 0, 1, "dinner");
    expect(r.effect).toEqual({ type: "remove", day: 0, slot: 1 });
  });

  it("an option change selects the activity and drops a waiting slot", () => {
    const waiting = tapSlot(NO_PENDING, 0, 0, null).pending;
    expect(selectActivity(waiting, "dinner")).toEqual({
      activity: "dinner",
      slot: null,
    });
  });

  it("rest clears an occupied slot and escape clears the pick", () => {
    const rest = tapActivity(NO_PENDING, "rest").pending;
    expect(tapSlot(rest, 1, 1, "dinner").effect).toEqual({
      type: "remove",
      day: 1,
      slot: 1,
    });
    expect(clearPending()).toEqual(NO_PENDING);
  });
});

describe("weekEndText", () => {
  it("makes a skirmish week warm and not quiet", () => {
    const t = weekEndText("skirmish", [], "100%");
    expect(t.due).toBe(true);
    expect(t.button).toBe("Start the skirmish");
    expect(t.line).toContain("always on patrol");
    expect(t.line).not.toMatch(/quiet|nothing landed|doctor/i);
  });
  it("keeps the full battle lines by reason", () => {
    const t = weekEndText("full", ["exposure"], "80%");
    expect(t.button).toBe("Start the battle");
    expect(t.line).toContain("80%");
    expect(weekEndText("full", ["reservoir"], "80%").line).toContain("flaring");
    expect(weekEndText("full", ["doctor"], "80%").line).toContain("doctor");
  });
  it("is a friendly virus beat with Continue when there is no battle", () => {
    const t = weekEndText(null, [], "90%");
    expect(t.due).toBe(false);
    expect(t.button).toBe("Continue");
    expect(t.line).toContain("virus");
  });
});

describe("battleOddsText", () => {
  it("names the chance as a full battle", () => {
    expect(battleOddsText(0.4)).toContain("full battle");
    expect(battleOddsText(0.4)).toContain("40%");
  });
});

describe("lifeStatusModel", () => {
  const cellOf = (l: LifeState, id: string) =>
    lifeStatusModel(l).cells.find((c) => c.id === id)!;

  it("has Points, Energy, Medication and Score in order", () => {
    expect(
      lifeStatusModel(createLife({ seed: 1 })).cells.map((c) => c.label),
    ).toEqual(["Points", "Energy", "Medication", "Score"]);
  });

  it("reads points earned out of the target, with planned points in the sentence", () => {
    const fresh = createLife({ seed: 1 });
    const p = cellOf(fresh, "points");
    expect(p.value).toBe(`0/${fresh.goal.target}`);
    expect(p.state).toBe("to build");
    const l = put(fresh, 0, 0, "yard");
    const planned = cellOf(l, "points");
    expect(planned.explain).toContain("with your plan");
    expect(planned.bar).toMatchObject({ kind: "fill", solid: 0 });
  });

  it("says goal met once the target is reached", () => {
    const l = createLife({ seed: 1 });
    const met = {
      ...l,
      goal: { points: l.goal.target, target: l.goal.target },
    };
    expect(cellOf(met, "points").state).toBe("goal met");
  });

  it("shows energy now and after the plan in words", () => {
    const fresh = createLife({ seed: 1 });
    const e = cellOf(fresh, "energy");
    expect(e.value.startsWith(`${fresh.energy}/6`)).toBe(true);
    expect(e.state).toBe("plenty");
    const spent = cellOf(put(fresh, 0, 0, "lake"), "energy");
    expect(spent.value).toMatch(/^\d\/6, then \d$/);
    expect(spent.explain).toContain("after your plan");
  });

  it("shows doses and charges for the planned medication level", () => {
    const m = cellOf(createLife({ seed: 1 }), "medication");
    expect(m.value).toBe("3/3 doses");
    expect(m.state).toBe("full");
    expect(m.explain).toContain("antifungal");
  });

  it("shows planned Choices and the earlier total", () => {
    const l = createLife({ seed: 1 });
    expect(cellOf(l, "score").value).toBe("Choices 90");
    expect(cellOf(l, "score").state).toBe("planned");
    const later = lifeStatusModel(l, 315).cells.find((c) => c.id === "score")!;
    expect(later.explain).toContain("Earlier weeks: 315");
  });
});

describe("medStateWord and chargesText", () => {
  it("names the dose states", () => {
    expect(medStateWord(3, 3)).toBe("full");
    expect(medStateWord(2, 3)).toBe("reduced");
    expect(medStateWord(1, 3)).toBe("low");
    expect(medStateWord(0, 3)).toBe("none");
  });

  it("lists charges plainly", () => {
    expect(chargesText({ antibacterial: 1, antifungal: 2, strong: 0 })).toBe(
      "2 antifungal, 1 antibacterial",
    );
    expect(chargesText({ antibacterial: 0, antifungal: 0, strong: 0 })).toBe(
      "no charges",
    );
  });
});

describe("weekPlayStops", () => {
  /** What "Play the week" does: advanceDay until a stop, returning the days it played. */
  const playWeek = (start: LifeState) => {
    let life = start;
    const days: number[] = [];
    for (;;) {
      const day = life.day;
      const step = advanceDay(life);
      life = step.state;
      days.push(day);
      if (weekPlayStops(step.events)) break;
    }
    return { life, days };
  };

  it("plays a quiet week to the end in one go", () => {
    const { life, days } = playWeek(createLife({ seed: 1 }));
    if (life.symptoms.length === 0) expect(days).toEqual([0, 1, 2]);
    expect(life.day).toBeGreaterThanOrEqual(1);
  });

  it("stops on the morning after a sleepover without the pills", () => {
    const l = put(createLife({ seed: 1 }), 0, 1, "sleepover", false);
    const { days } = playWeek(l);
    expect(days).toEqual([0]);
  });

  it("does not stop on a plain day", () => {
    expect(weekPlayStops([{ type: "DayStarted", day: 1 }])).toBe(false);
  });
});
