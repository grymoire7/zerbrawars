import { ARCS } from "./arcs";
import { describe, expect, it } from "vitest";
import type { WeekScore } from "../sim/score";
import type { RecordResult } from "./bestScores";
import type { CycleRecord, CycleResult } from "../sim/campaign";
import type { LifeState } from "../sim/life/types";
import {
  bestLines,
  goalsHeadline,
  summerEnding,
  scoreCard,
  summerOddsRow,
  thisWeekRows,
} from "./summaryModel";

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

const record = (
  score: WeekScore,
  over: Partial<CycleRecord> = {},
): CycleRecord =>
  ({
    score,
    goalMet: false,
    exposure: 0.35,
    result: { kind: "quiet" },
    ...over,
  }) as unknown as CycleRecord;
const battle = (
  battleKind: "full" | "skirmish",
  grade: "cleared" | "contained" | "neededBackup",
  landed: boolean,
) =>
  ({
    kind: "battle",
    battleKind,
    reasons: landed ? ["exposure"] : [],
    outcome: { grade },
  }) as unknown as CycleResult;

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
      scoreCard(
        [record(met)],
        2,
        { choices: 255, outcome: 100, total: 355 },
        null,
      ).weeks[0].choices,
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
      [record(week), record(week)],
      2,
      { choices: 430, outcome: 200, total: 630 },
      null,
    );
    expect(card.weeks).toHaveLength(2);
    expect(card.weeks[0]).toEqual({
      head: "Week 1: 315",
      odds: "Odds 35%, nothing came home. Just a virus, no fight.",
      choices:
        "Choices 215: living 120, odds pushed 65, routine kept 30, checked 0",
      outcome: "Outcome 100: tissue 40, fight 40, clear 20",
    });
    expect(card.total).toBe("Total: Choices 430 + Outcome 200 = 630");
    expect(card.best).toEqual([]);
    expect(card.headline).toBe("Goals met: 0 of 2. A quieter summer.");
  });
  it("counts the met goals in the headline", () => {
    const met = record(week, { goalMet: true });
    expect(
      scoreCard([met, met], 2, { choices: 430, outcome: 200, total: 630 }, null)
        .headline,
    ).toBe("Goals met: 2 of 2. You lived it fully.");
  });
});

describe("goalsHeadline", () => {
  it("reads 2, 1 and 0 of 2 plainly", () => {
    expect(goalsHeadline(2, 2)).toBe("Goals met: 2 of 2. You lived it fully.");
    expect(goalsHeadline(1, 2)).toBe("Goals met: 1 of 2. One goal met.");
    expect(goalsHeadline(0, 2)).toBe("Goals met: 0 of 2. A quieter summer.");
  });
});

describe("summerOddsRow", () => {
  const row = (exposure: number, result: CycleResult) =>
    summerOddsRow(record(week, { exposure, result }));
  it("says each full-battle grade, landed or not", () => {
    expect(row(0.35, battle("full", "cleared", false))).toBe(
      "Odds 35%, nothing came home. All clear.",
    );
    expect(row(0.7, battle("full", "contained", true))).toBe(
      "Odds 70%, something came home. Contained.",
    );
    expect(row(0.7, battle("full", "neededBackup", true))).toBe(
      "Odds 70%, something came home. Backup arrived.",
    );
    expect(row(0.35, battle("full", "contained", false))).toBe(
      "Odds 35%, nothing came home. Contained.",
    );
  });
  it("uses All quiet and Still stirring for a skirmish", () => {
    expect(row(0.02, battle("skirmish", "cleared", false))).toBe(
      "Odds under 5%, nothing came home. All quiet.",
    );
    expect(row(0.35, battle("skirmish", "contained", false))).toBe(
      "Odds 35%, nothing came home. Still stirring.",
    );
  });
  it("names a virus-only week and never blames", () => {
    expect(row(0.35, { kind: "quiet" })).toBe(
      "Odds 35%, nothing came home. Just a virus, no fight.",
    );
    const all = [
      goalsHeadline(0, 2),
      goalsHeadline(1, 2),
      row(0.7, battle("full", "neededBackup", true)),
      row(0.35, battle("skirmish", "contained", false)),
    ].join(" ");
    expect(all).not.toMatch(/lost|failed|defeat|fault/i);
  });
});

describe("summerEnding", () => {
  const summer = ARCS[1]!;
  it("picks the line from goals met, warm for each", () => {
    const none = summerEnding(summer, 0, 2, false);
    const one = summerEnding(summer, 1, 2, false);
    const all = summerEnding(summer, 2, 2, false);
    expect(none).toHaveLength(1);
    expect(new Set([none[0], one[0], all[0]]).size).toBe(3);
    expect(none[0]).toMatch(/quieter summer/);
    for (const l of [...none, ...one, ...all])
      expect(l).not.toMatch(/lost|fail|defeat|your fault/i);
  });
  it("adds the saved line only when the best score was saved", () => {
    expect(summerEnding(summer, 1, 2, true)).toEqual([
      summerEnding(summer, 1, 2, false)[0],
      "Your best score is saved.",
    ]);
  });
  it("is empty for an arc that is not the summer", () => {
    expect(summerEnding(ARCS[0]!, 2, 2, true)).toEqual([]);
  });
});
