import { describe, expect, it } from "vitest";
import type { WeekScore } from "../sim/score";
import type { RecordResult } from "./bestScores";
import type { CycleResult } from "../sim/campaign";
import type { LifeState } from "../sim/life/types";
import { bestLines, scoreCard, thisWeekRows } from "./summaryModel";

const week: WeekScore = {
  version: 4,
  choices: {
    living: 120,
    dodged: 65,
    meds: 30,
    checked: 0,
    goalMet: 0,
    total: 215,
  },
  outcome: { tissue: 40, fight: 40, clear: 20, total: 100 },
  total: 315,
};
const entry = { total: 600, choices: 300, outcome: 300, runs: 2, at: "x" };
const rec = (over: Partial<RecordResult>): RecordResult => ({
  entry,
  previous: entry,
  newBestTotal: false,
  newBestChoices: false,
  stored: true,
  ...over,
});

describe("thisWeekRows", () => {
  const life = (points: number) =>
    ({ goal: { points, target: 13 } }) as unknown as LifeState;
  const outcome = (grade: "cleared" | "contained" | "neededBackup") => ({
    grade,
    tissue: { health: 10, max: 20, lost: 10 },
  });
  const full = (grade: "cleared" | "contained" | "neededBackup") =>
    ({
      kind: "battle",
      battleKind: "full",
      reasons: ["exposure"],
      outcome: outcome(grade),
    }) as unknown as CycleResult;
  const odds = { value: "35%", band: "some" } as const;

  it("reads the sketch: lived, odds, fight, score", () => {
    expect(
      thisWeekRows(life(13), full("neededBackup"), odds, true, week),
    ).toEqual([
      { label: "Lived", text: "13 of 13 points, goal met" },
      { label: "Odds", text: "35%: something came home anyway" },
      { label: "Fight", text: "backup arrived, tissue 10 of 20" },
      { label: "Score", text: "315 = Choices 215 + Outcome 100" },
    ]);
  });
  it("says short of the goal and nothing came home, without blame", () => {
    const rows = thisWeekRows(life(9), full("cleared"), odds, false, week);
    expect(rows[0].text).toBe("9 of 13 points, short of the goal");
    expect(rows[1].text).toBe("35%: nothing came home");
    expect(rows[2].text).toBe("all clear, tissue 10 of 20");
    expect(JSON.stringify(rows)).not.toMatch(/lost|failed|defeat|fault/i);
  });
  it("calls a big week's landing just that", () => {
    const rows = thisWeekRows(
      life(13),
      full("contained"),
      { value: "70%", band: "likely" },
      true,
      week,
    );
    expect(rows[1].text).toBe("70%: something came home");
    expect(rows[2].text).toBe("contained, tissue 10 of 20");
  });
  it("uses All quiet and Still stirring for a skirmish", () => {
    const skirmish = (grade: "cleared" | "contained") =>
      ({
        kind: "battle",
        battleKind: "skirmish",
        reasons: [],
        outcome: outcome(grade),
      }) as unknown as CycleResult;
    expect(
      thisWeekRows(life(13), skirmish("cleared"), odds, false, week)[2].text,
    ).toBe("all quiet, tissue 10 of 20");
    expect(
      thisWeekRows(life(13), skirmish("contained"), odds, false, week)[2].text,
    ).toBe("still stirring, tissue 10 of 20");
  });
});

describe("a met goal", () => {
  const met: WeekScore = {
    ...week,
    choices: { ...week.choices, goalMet: 40, total: 255 },
    total: 355,
  };
  it("shows the +40 on the summary", () => {
    expect(
      scoreCard([met], { choices: 255, outcome: 100, total: 355 }, null)
        .weeks[0].choices,
    ).toContain("goal met +40");
  });
});

describe("bestLines", () => {
  it("says New best when it is one", () => {
    expect(bestLines(rec({ newBestTotal: true }))).toEqual([
      "New best on this summer!",
    ]);
  });
  it("otherwise names the best", () => {
    expect(bestLines(rec({}))).toEqual(["Best on this summer: 600"]);
  });
  it("adds the best-choices line only when a previous best exists", () => {
    expect(bestLines(rec({ newBestChoices: true }))).toHaveLength(2);
    expect(
      bestLines(rec({ newBestChoices: true, previous: null })),
    ).toHaveLength(1);
  });
  it("is empty without a saved record", () => {
    expect(bestLines(null)).toEqual([]);
    expect(bestLines(rec({ stored: false, entry: null }))).toEqual([]);
  });
});

describe("scoreCard", () => {
  it("lists every part per week and a total row", () => {
    const card = scoreCard(
      [week, week],
      { choices: 430, outcome: 200, total: 630 },
      null,
    );
    expect(card.weeks).toHaveLength(2);
    expect(card.weeks[0]).toEqual({
      head: "Week 1: 315",
      choices:
        "Choices 215: living 120, odds pushed 65, routine kept 30, checked 0",
      outcome: "Outcome 100: tissue 40, fight 40, clear 20",
    });
    expect(card.total).toBe("Total: Choices 430 + Outcome 200 = 630");
    expect(card.best).toEqual([]);
  });
});
