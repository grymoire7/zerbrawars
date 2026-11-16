import { describe, expect, it } from "vitest";
import { campaignSummary } from "./campaign";
import { CAMPAIGN_BOTS, playCampaign, type CampaignBot } from "./campaignBots";
import type { CycleRecord } from "./campaign";

// Re-measures the ranges in docs/specs/b1a-design.md section 1.3 with the existing bots over a few
// hundred seeds. See the table with
// `npx vitest run src/sim/score.balance.test.ts --silent=false`.

const SEEDS = 200;
const PART_MAX: Record<string, number> = {};

const BOTS: Record<string, CampaignBot> = {
  home: CAMPAIGN_BOTS.home,
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
  /** Share of week-1 weeks that met the goal (the week-1 hand). */
  goal1: number;
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
    goal1: 0,
    topChoices: 0,
  };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const c = playCampaign(bot, seed);
    const s = campaignSummary(c).score;
    for (const h of c.history) {
      if (h.score.choices.goalMet > 0) {
        r.goal += 1 / (SEEDS * c.history.length);
        if (h.week === 1) r.goal1 += 1 / SEEDS;
      }
      for (const n of parts(h)) expect(n).toBeGreaterThanOrEqual(0);
      for (const [k, v] of Object.entries({
        ...h.score.choices,
        ...h.score.outcome,
      }))
        PART_MAX[k] = Math.max(PART_MAX[k] ?? 0, v);
      // The all-risky week with six energy reaches 17 points (170); the smarter hand never passes 14.
      expect(h.score.choices.living).toBeLessThanOrEqual(170);
      // Odds pushed at 0.7 per percent: yard indoors 25 plus the beach 21 is the most week 1 can
      // push. Week 2's hand fits three cards (each costs 2 energy, the trip 4), and the most the
      // smarter versions push is the travel plan 30, dry wood 27 and the rake 23: 80.
      expect(h.score.choices.dodged).toBeLessThanOrEqual(
        h.week === 1 ? 46 : 80,
      );
      expect(h.score.choices.goalMet).toBeLessThanOrEqual(40);
      expect(h.score.choices.meds).toBeLessThanOrEqual(90);
      expect(h.score.choices.checked).toBeLessThanOrEqual(20);
      expect(h.score.outcome.tissue).toBeLessThanOrEqual(40);
      expect(h.score.outcome.fight).toBeGreaterThanOrEqual(10);
      expect(h.score.outcome.fight).toBeLessThanOrEqual(40);
      expect(h.score.outcome.clear).toBeLessThanOrEqual(20);
    }
    expect(s.total).toBe(s.choices + s.outcome);
    // Best reachable: about 283 + 20 per week at 0.5; at 0.7 odds pushed the planner scores about
    // 790, and up to about 850 on a lucky seed now that the sleepover costs no energy for its pills.
    expect(s.total).toBeLessThanOrEqual(870);
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

  // Measured at 200 seeds (Score v4, odds pushed 0.7, goal 13, pills left behind by a 30% roll):
  // home 391, skipMeds 575, risky 668, mixed 736, forgetful 787, smarter 792, planner 792. Bands are
  // about +-30.
  it("keeps each bot near its measured range", () => {
    const bands: Record<string, [number, number]> = {
      home: [380, 405],
      skipMeds: [545, 605],
      risky: [640, 700],
      mixed: [705, 765],
      forgetful: [755, 820],
      smarter: [760, 825],
      planner: [760, 825],
    };
    for (const [n, [lo, hi]] of Object.entries(bands)) {
      expect(t(n), n).toBeGreaterThanOrEqual(lo);
      expect(t(n), n).toBeLessThanOrEqual(hi);
    }
    expect(rows.home.choices).toBeLessThanOrEqual(200);
  });

  it("spreads the strategies: home, risky, mixed, smarter, planner", () => {
    // Measured gaps: 277 (risky over home), 68, 56, 0 (smarter plays the planner's plan).
    expect(t("risky") - t("home")).toBeGreaterThanOrEqual(200);
    expect(t("mixed") - t("risky")).toBeGreaterThanOrEqual(40);
    expect(t("smarter") - t("mixed")).toBeGreaterThanOrEqual(40);
    expect(t("planner")).toBeGreaterThanOrEqual(t("smarter"));
    expect(t("smarter") - t("forgetful")).toBeGreaterThanOrEqual(0);
    expect(t("smarter") - t("skipMeds")).toBeGreaterThanOrEqual(150);
  });

  it("meets the goal with any plan that plays cards, never when staying home", () => {
    // Plans are luck-free, so a bot's goal rate is its plan's, not a dice outcome. Measured at goal
    // 13 (week 1 figures; across both weeks forgetful is about 50% and skipMeds 0% in week 2, so
    // forgetful and risky assert the week-1 rate goal1 below and the rest assert the both-weeks
    // rate): forgetful 100%, smarter and planner 95%, mixed 91%, risky 86%, skipMeds 41% (all-smarter
    // scored 12 and reached the goal 0% of the time while the sleepover's pills cost 1 energy; with
    // that gone a safe plan fits a fifth card when energy carries over), home 0%.
    expect(rows.home.goal).toBe(0);
    expect(rows.skipMeds.goal).toBeLessThanOrEqual(0.5);
    // Forgetful's broken routine (the late game night) is a week-1 hand; in week 2 it plays the
    // all-smarter plan, which by design cannot reach the goal.
    expect(rows.forgetful.goal1).toBeGreaterThanOrEqual(0.95);
    for (const n of ["smarter", "planner"])
      expect(rows[n].goal, n).toBeGreaterThanOrEqual(0.9);
    expect(rows.mixed.goal).toBeGreaterThanOrEqual(0.8);
    // The risky range is the week-1 hand's. In week 2 a late doctor visit drops the trip (the last
    // slot, the only card still to play), so risky meets that goal in about half the weeks; the
    // campaign-wide risky rate (55-85%) is checked in campaign.balance.test.ts.
    expect(rows.risky.goal1).toBeGreaterThanOrEqual(0.75);
    expect(rows.risky.goal1).toBeLessThanOrEqual(0.95);
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
