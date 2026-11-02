import { describe, expect, it } from "vitest";
import type { WeekScore } from "../sim/score";
import type { RecordResult } from "./bestScores";
import { bestLines, scoreCard, weekScoreLine } from "./summaryModel";

const week: WeekScore = {
  version: 1,
  choices: { living: 120, dodged: 65, meds: 30, checked: 0, total: 215 },
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

describe("weekScoreLine", () => {
  it("shows the total with its two parts", () => {
    expect(weekScoreLine(week)).toBe(
      "This week: 315 (Choices 215 + Outcome 100)",
    );
  });
});

describe("bestLines", () => {
  it("says New best when it is one", () => {
    expect(bestLines(rec({ newBestTotal: true }))).toEqual([
      "New best on this seed!",
    ]);
  });
  it("otherwise names the best", () => {
    expect(bestLines(rec({}))).toEqual(["Best on this seed: 600"]);
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
      choices: "Choices 215: living 120, dodged 65, meds 30, checked 0",
      outcome: "Outcome 100: tissue 40, fight 40, clear 20",
    });
    expect(card.total).toBe("Total: Choices 430 + Outcome 200 = 630");
    expect(card.best).toEqual([]);
  });
});
