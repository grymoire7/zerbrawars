import { describe, expect, it } from "vitest";
import { campaignSummary } from "./campaign";
import {
  CAMPAIGN_BOTS,
  careless,
  playCampaign,
  type CampaignBot,
} from "./campaignBots";
import type { CycleRecord } from "./campaign";

// Re-measures the ranges in docs/specs/b1a-design.md section 1.3 with the existing bots over a few
// hundred seeds. See the table with
// `npx vitest run src/sim/score.balance.test.ts --silent=false`.

const SEEDS = 200;
const PART_MAX: Record<string, number> = {};

const BOTS: Record<string, CampaignBot> = {
  home: CAMPAIGN_BOTS.home,
  careless,
  mixed: CAMPAIGN_BOTS.mixed,
  risky: CAMPAIGN_BOTS.risky,
  skipMeds: CAMPAIGN_BOTS.skipMeds,
  forgetful: CAMPAIGN_BOTS.forgetful,
  smarter: CAMPAIGN_BOTS.smarter,
  planner: CAMPAIGN_BOTS.planner,
};

interface Row {
  choices: number;
  outcome: number;
  total: number;
  min: number;
  max: number;
  /** Share of weeks that met the life-points goal. */
  goal: number;
  /** Highest single-campaign Choices, for the best-possible reference. */
  topChoices: number;
}

const parts = (h: CycleRecord) => [
  ...Object.values(h.score.choices),
  ...Object.values(h.score.outcome),
  h.score.total,
];

function survey(bot: CampaignBot): Row {
  const r: Row = {
    choices: 0,
    outcome: 0,
    total: 0,
    min: Infinity,
    max: 0,
    goal: 0,
    topChoices: 0,
  };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const c = playCampaign(bot, seed);
    const s = campaignSummary(c).score;
    for (const h of c.history) {
      if (h.score.choices.goalMet > 0) r.goal += 1 / (SEEDS * c.history.length);
      for (const n of parts(h)) expect(n).toBeGreaterThanOrEqual(0);
      for (const [k, v] of Object.entries({
        ...h.score.choices,
        ...h.score.outcome,
      }))
        PART_MAX[k] = Math.max(PART_MAX[k] ?? 0, v);
      // The all-risky week with six energy reaches 17 points (170); the smarter hand never passes 14.
      expect(h.score.choices.living).toBeLessThanOrEqual(170);
      // Odds pushed at 0.7 per percent: yard indoors 25 plus the beach 21 is the most a week can push.
      expect(h.score.choices.dodged).toBeLessThanOrEqual(46);
      expect(h.score.choices.goalMet).toBeLessThanOrEqual(40);
      expect(h.score.choices.meds).toBeLessThanOrEqual(90);
      expect(h.score.choices.checked).toBeLessThanOrEqual(20);
      expect(h.score.outcome.tissue).toBeLessThanOrEqual(40);
      expect(h.score.outcome.fight).toBeGreaterThanOrEqual(10);
      expect(h.score.outcome.fight).toBeLessThanOrEqual(40);
      expect(h.score.outcome.clear).toBeLessThanOrEqual(20);
    }
    expect(s.total).toBe(s.choices + s.outcome);
    // Best reachable: about 283 + 20 per week at 0.5; at 0.7 odds pushed the planner scores 803.
    expect(s.total).toBeLessThanOrEqual(840);
    r.choices += s.choices / SEEDS;
    r.outcome += s.outcome / SEEDS;
    r.total += s.total / SEEDS;
    r.min = Math.min(r.min, s.total);
    r.max = Math.max(r.max, s.total);
    r.topChoices = Math.max(r.topChoices, s.choices);
  }
  return r;
}

describe("score ranges", () => {
  const rows = Object.fromEntries(
    Object.entries(BOTS).map(([n, b]) => [n, survey(b)]),
  ) as Record<string, Row>;

  it("prints the table", () => {
    const f = (x: number) => x.toFixed(0).padStart(8);
    const lines = [
      "bot              choices outcome   total     min     max  goal%",
      ...Object.entries(rows).map(
        ([n, r]) =>
          n.padEnd(16) +
          f(r.choices) +
          f(r.outcome) +
          f(r.total) +
          f(r.min) +
          f(r.max) +
          f(100 * r.goal),
      ),
    ];
    lines.push(`part maxima: ${JSON.stringify(PART_MAX)}`);
    (
      globalThis as unknown as { console: { log(s: string): void } }
    ).console.log(lines.join("\n"));
  });

  const t = (n: string) => rows[n].total;

  // Measured at 200 seeds (Score v4, odds pushed 0.7): home 391, careless 596, skipMeds 606,
  // risky 694, mixed 733, forgetful 744, smarter 803, planner 803. Bands are about +-30.
  it("keeps each bot near its measured range", () => {
    const bands: Record<string, [number, number]> = {
      home: [380, 405],
      careless: [560, 640],
      skipMeds: [570, 640],
      risky: [660, 730],
      mixed: [700, 770],
      forgetful: [710, 780],
      smarter: [770, 840],
      planner: [770, 840],
    };
    for (const [n, [lo, hi]] of Object.entries(bands)) {
      expect(t(n), n).toBeGreaterThanOrEqual(lo);
      expect(t(n), n).toBeLessThanOrEqual(hi);
    }
    expect(rows.home.choices).toBeLessThanOrEqual(200);
  });

  it("spreads the strategies: home, careless, risky, mixed, smarter, planner", () => {
    // Measured gaps: 205, 98, 39, 70, 0 (smarter is already the best plan on the week-1 hand).
    expect(t("careless") - t("home")).toBeGreaterThanOrEqual(150);
    expect(t("risky") - t("careless")).toBeGreaterThanOrEqual(60);
    expect(t("mixed") - t("risky")).toBeGreaterThanOrEqual(30);
    expect(t("smarter") - t("mixed")).toBeGreaterThanOrEqual(40);
    expect(t("planner")).toBeGreaterThanOrEqual(t("smarter"));
    expect(t("smarter") - t("forgetful")).toBeGreaterThanOrEqual(40);
    expect(t("smarter") - t("skipMeds")).toBeGreaterThanOrEqual(150);
  });

  it("meets the goal with any plan that plays cards, never when staying home", () => {
    // Plans are luck-free, so a bot's goal rate is its plan's, not a dice outcome: twelve points
    // is within reach of every plan that uses four cards (design 5 predicted 85-100%).
    expect(rows.home.goal).toBe(0);
    for (const n of ["careless", "risky", "smarter", "planner", "forgetful"])
      expect(rows[n].goal, n).toBeGreaterThanOrEqual(0.95);
    expect(rows.mixed.goal).toBeGreaterThanOrEqual(0.85);
  });

  it("makes the planner and smarter the best on Choices", () => {
    expect(rows.planner.choices).toBeGreaterThanOrEqual(rows.smarter.choices);
    for (const [n, r] of Object.entries(rows))
      if (n !== "smarter" && n !== "planner")
        expect(rows.smarter.choices, n).toBeGreaterThan(r.choices);
  });

  it("scores the same bot and seed the same twice", () => {
    const a = campaignSummary(playCampaign(BOTS.mixed, 7)).score;
    const b = campaignSummary(playCampaign(BOTS.mixed, 7)).score;
    expect(a).toEqual(b);
  });
});
