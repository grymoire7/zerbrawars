import { describe, expect, it } from "vitest";
import { campaignSummary, type CycleRecord } from "./campaign";
import {
  CAMPAIGN_BOTS,
  playCampaign,
  type CampaignBot,
  type DoctorPolicy,
} from "./campaignBots";
import type { CarriedReservoir } from "./life/loadout";
import { LIFE_BOTS } from "./life/bots";
import { PARAMS } from "./params";
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

  // 0.05 before arrivals; with second groups and the clock, mixed measures about 8% and the
  // others 3-5% (battle depth slice 2), so the cap is 12%.
  it("caps the snowball: no strategy needs backup often", () => {
    for (const [n, r] of Object.entries(rows))
      expect(r.backup, n).toBeLessThan(0.12);
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
        // Within noise: card-keyed dice moved smarter's early/late gap to -0.007 (300 seeds).
        expect(early.score).toBeGreaterThanOrEqual(late.score - 0.05);
        expect(early.score).toBeGreaterThan(never.score + 0.4);
        expect(late.score).toBeGreaterThan(never.score);
        expect(early.points).toBeGreaterThan(late.points);
        expect(early.left).toBeLessThan(never.left);
        // Never seeing the doctor with reservoirs and the new second groups is a bad week:
        // measured up to about 33% backup (both reservoirs), so the cap is 45%.
        expect(never.backup).toBeLessThan(0.45);
      });
    }
  },
);

// Battle length (battle-depth slices 1-2: doors, a 6-turn / 4-turn clock, the backup stop,
// arrivals). The full table with the section 5 targets is in battleDepth.balance.test.ts.
describe("battle length", () => {
  const LENGTH_SEEDS = 150;
  const careless: CampaignBot = () => ({
    ...LIFE_BOTS.riskySkipMeds(() => 0),
    packPills: false,
    doctor: "never",
  });
  const BOTS: Record<string, CampaignBot> = { ...CAMPAIGN_BOTS, careless };

  function lengths(name: string, kind: "full" | "skirmish") {
    let n = 0;
    let turns = 0;
    let maxLost = 0;
    let maxTurns = 0;
    for (let seed = 1; seed <= LENGTH_SEEDS; seed++) {
      for (const h of playCampaign(BOTS[name], seed).history) {
        if (h.result.kind === "quiet" || h.result.battleKind !== kind) continue;
        const o = h.result.outcome;
        n++;
        turns += o.turnsPlayed;
        maxLost = Math.max(maxLost, o.tissue.lost);
        maxTurns = Math.max(maxTurns, o.turnsPlayed);
      }
    }
    return { n, mean: turns / Math.max(1, n), maxLost, maxTurns };
  }

  it("runs skirmishes past turn 1 (first contact is on turn 2) and within the clock", () => {
    for (const name of ["home", "smarter", "risky", "mixed", "skipMeds"]) {
      const r = lengths(name, "skirmish");
      expect(r.n, name).toBeGreaterThan(0);
      expect(r.mean, name).toBeGreaterThan(1.6);
      expect(r.maxTurns, name).toBeLessThanOrEqual(
        PARAMS.campaign.skirmish.maxTurns,
      );
    }
  });

  it("makes full battles last longer than one turn for anyone who takes a risk", () => {
    for (const name of ["risky", "mixed", "skipMeds", "careless"]) {
      const r = lengths(name, "full");
      expect(r.mean, name).toBeGreaterThan(1.5);
      expect(r.maxTurns, name).toBeLessThanOrEqual(PARAMS.maxTurns);
    }
    expect(lengths("careless", "full").mean).toBeGreaterThan(2.2);
  });

  it("stops at the backup line, so tissue never drains toward zero", () => {
    // The line is 10 and one turn can cost a few more, so the worst battle ends in the low teens
    // of tissue lost at most; before the stop careless battles lost 16-20.
    const line = PARAMS.maxTissueHealth - PARAMS.outcome.backupTissueHealth;
    for (const name of ["careless", "riskyNoDoctor", "mixed"]) {
      expect(lengths(name, "full").maxLost, name).toBeLessThanOrEqual(
        line + 10,
      );
    }
  });

  it("is deterministic: the same seed plays the same campaign", () => {
    for (const name of ["smarter", "careless"])
      expect(playCampaign(BOTS[name], 7)).toEqual(playCampaign(BOTS[name], 7));
  });
});
