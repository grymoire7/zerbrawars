import { describe, expect, it } from "vitest";
import { campaignSummary, type CycleRecord } from "./campaign";
import {
  CAMPAIGN_BOTS,
  playCampaign,
  type CampaignBot,
  type DoctorPolicy,
} from "./campaignBots";
import type { CarriedReservoir } from "./life/loadout";
import { validateCampaign } from "./validate";

// Whole-campaign balance: each strategy plays the same seeded two-week campaigns, every battle by
// the thoughtful player. See the table with
// `npx vitest run src/sim/campaign.balance.test.ts --silent=false`. Every week battles: a full
// battle, or a skirmish when nothing landed ("skirm" cleared, "loose" not), except a viral doctor
// week ("quiet"). Per week a quiet week or cleared skirmish scores 3, a loose skirmish 1, a full
// battle cleared 2, contained 1, backup 0; "score" is the campaign total plus GOAL_SCORE per goal
// met, minus 1 per reservoir still carried at the end. "res2" is the share of campaigns that
// start week 2 with a reservoir. The thresholds are the design targets.

const SEEDS = 400;
const WEEK_SCORE = {
  quiet: 3,
  skirmish: 3,
  loose: 1,
  cleared: 2,
  contained: 1,
  neededBackup: 0,
};
const GOAL_SCORE = 1;

/** A finished week's WEEK_SCORE key. */
function weekResult(h: CycleRecord): keyof typeof WEEK_SCORE {
  if (h.result.kind === "quiet") return "quiet";
  if (h.result.battleKind === "skirmish")
    return h.result.outcome.grade === "cleared" ? "skirmish" : "loose";
  return h.result.outcome.grade;
}

interface Row {
  points: number;
  goals: number;
  quiet: number;
  skirm: number;
  loose: number;
  cleared: number;
  contained: number;
  backup: number;
  tissue: number;
  res2: number;
  left: number;
  doctor: number;
  early: number;
  score: number;
  /** Score over campaigns that start week 2 with a reservoir. */
  scoreRes: number;
  nRes: number;
}

function survey(name: string): Row {
  const r: Row = {
    points: 0,
    goals: 0,
    quiet: 0,
    skirm: 0,
    loose: 0,
    cleared: 0,
    contained: 0,
    backup: 0,
    tissue: 0,
    res2: 0,
    left: 0,
    doctor: 0,
    early: 0,
    score: 0,
    scoreRes: 0,
    nRes: 0,
  };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const c = playCampaign(CAMPAIGN_BOTS[name], seed);
    expect(validateCampaign(c)).toEqual([]);
    const s = campaignSummary(c);
    const weeks = c.history.length;
    r.points += s.points / SEEDS;
    r.goals += s.goalsMet / weeks / SEEDS;
    r.quiet += s.quietWeeks / weeks / SEEDS;
    r.skirm += s.skirmishes.cleared / weeks / SEEDS;
    r.loose += s.skirmishes.loose / weeks / SEEDS;
    r.cleared += s.grades.cleared / weeks / SEEDS;
    r.contained += s.grades.contained / weeks / SEEDS;
    r.backup += s.grades.neededBackup / weeks / SEEDS;
    r.tissue += s.tissueLost / SEEDS;
    r.left += s.reservoirsLeft / SEEDS;
    r.doctor += s.doctorVisits / SEEDS;
    r.early += s.earlyVisits / SEEDS;
    const score =
      c.history.reduce((n, h) => n + WEEK_SCORE[weekResult(h)], 0) +
      GOAL_SCORE * s.goalsMet -
      s.reservoirsLeft;
    r.score += score / SEEDS;
    if (c.history[1].reservoirsIn > 0) {
      r.res2 += 1 / SEEDS;
      r.nRes++;
      r.scoreRes += score;
    }
  }
  r.scoreRes = r.nRes > 0 ? r.scoreRes / r.nRes : 0;
  return r;
}

describe("campaign strategies", () => {
  const rows = Object.fromEntries(
    Object.keys(CAMPAIGN_BOTS).map((n) => [n, survey(n)]),
  ) as Record<string, Row>;
  const pct = (x: number) => `${Math.round(100 * x)}%`.padStart(6);
  const num = (x: number, d = 2) => x.toFixed(d).padStart(6);

  it("prints the table", () => {
    const lines = [
      "strategy           pts  goal quiet skirm loose clear  cont  back tissue  res2  left  doc early score w/res",
      ...Object.entries(rows).map(
        ([n, r]) =>
          n.padEnd(16) +
          num(r.points, 1) +
          pct(r.goals) +
          pct(r.quiet) +
          pct(r.skirm) +
          pct(r.loose) +
          pct(r.cleared) +
          pct(r.contained) +
          pct(r.backup) +
          num(r.tissue, 1).padStart(7) +
          pct(r.res2) +
          num(r.left) +
          num(r.doctor) +
          num(r.early) +
          num(r.score) +
          num(r.scoreRes),
      ),
    ];
    (
      globalThis as unknown as { console: { log(s: string): void } }
    ).console.log(lines.join("\n"));
  });

  const goalMeeters = Object.entries(rows).filter(([, r]) => r.goals >= 0.95);

  it("keeps staying home pointless, and it still skirmishes", () => {
    expect(rows.home.points).toBe(0);
    expect(rows.home.skirm + rows.home.loose).toBeGreaterThan(0.6);
    expect(rows.home.quiet).toBeLessThan(0.4);
    expect(rows.home.left).toBe(0);
  });

  it("makes the smarter weeks the best overall", () => {
    for (const [n, r] of Object.entries(rows))
      if (n !== "smarter")
        expect(rows.smarter.score, n).toBeGreaterThan(r.score);
  });

  it("never carries a reservoir out of a skirmish-only campaign", () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const c = playCampaign(CAMPAIGN_BOTS.home, seed);
      expect(c.history.every((h) => h.carried.length === 0)).toBe(true);
    }
  });

  it("makes the smarter weeks the best play of those that meet the goal", () => {
    expect(rows.smarter.goals).toBeGreaterThanOrEqual(0.95);
    for (const [n, r] of goalMeeters) {
      if (n !== "smarter")
        expect(rows.smarter.score, n).toBeGreaterThan(r.score);
    }
    expect(rows.smarter.score).toBeGreaterThan(rows.risky.score + 0.5);
    expect(rows.smarter.left).toBeLessThan(0.02);
  });

  it("lets skipped doses and the never-doctor habit cost something", () => {
    expect(rows.skipMeds.score).toBeLessThan(rows.smarter.score);
    expect(rows.riskyNoDoctor.score).toBeLessThan(rows.riskyDoctorEarly.score);
    expect(rows.riskyNoDoctor.left).toBeGreaterThan(rows.riskyDoctorEarly.left);
    // Points pay for the risk: the doctor-avoiding risky player scores the most.
    expect(rows.riskyNoDoctor.points).toBeGreaterThanOrEqual(rows.risky.points);
  });

  it("caps the snowball: no strategy needs backup often", () => {
    for (const [n, r] of Object.entries(rows))
      expect(r.backup, n).toBeLessThan(0.05);
  });
});

// One week carrying fixed reservoirs (energy 6, what a contained week hands on), the same cards
// under each doctor policy.
const RESERVOIRS: Record<string, CarriedReservoir[]> = {
  mold: [{ kind: "aspergillus", size: 2, hidden: true }],
  staph: [{ kind: "staph", size: 2, hidden: true }],
  both: [
    { kind: "aspergillus", size: 2, hidden: true },
    { kind: "staph", size: 2, hidden: true },
  ],
};
const DOCTOR_SEEDS = 300;

function doctorSurvey(
  cards: string,
  doctor: DoctorPolicy,
  reservoirs: CarriedReservoir[],
): { score: number; points: number; left: number; backup: number } {
  const bot: CampaignBot = (roll) => ({
    ...CAMPAIGN_BOTS[cards](roll),
    doctor,
  });
  const out = { score: 0, points: 0, left: 0, backup: 0 };
  for (let seed = 1; seed <= DOCTOR_SEEDS; seed++) {
    const c = playCampaign(bot, seed, { cycles: 1, reservoirs, energy: 6 });
    const h = c.history[0];
    const grade = weekResult(h);
    out.score += (WEEK_SCORE[grade] - h.carried.length) / DOCTOR_SEEDS;
    out.points += h.points / DOCTOR_SEEDS;
    out.left += h.carried.length / DOCTOR_SEEDS;
    if (grade === "neededBackup") out.backup += 1 / DOCTOR_SEEDS;
  }
  return out;
}

describe.each(Object.keys(RESERVOIRS))(
  "doctor timing with %s carried",
  (set) => {
    for (const cards of ["smarter", "riskyNoDoctor"]) {
      it(`pays to go early with ${cards} cards`, () => {
        const [early, late, never] = (["early", "late", "never"] as const).map(
          (p) => doctorSurvey(cards, p, RESERVOIRS[set]),
        );
        (
          globalThis as unknown as { console: { log(s: string): void } }
        ).console.log(
          `${set} ${cards}: ` +
            [early, late, never]
              .map(
                (r, i) =>
                  `${["early", "late", "never"][i]} score ${r.score.toFixed(2)} pts ${r.points.toFixed(1)} left ${r.left.toFixed(2)}`,
              )
              .join(" | "),
        );
        expect(early.score).toBeGreaterThanOrEqual(late.score);
        expect(early.score).toBeGreaterThan(never.score + 0.4);
        expect(late.score).toBeGreaterThan(never.score);
        expect(early.points).toBeGreaterThan(late.points);
        expect(early.left).toBeLessThan(never.left);
        // Even never seeing the doctor stays a bad week, not a disaster.
        expect(never.backup).toBeLessThan(0.1);
      });
    }
  },
);
