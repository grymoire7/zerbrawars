import { BOTS, playBattle, SUPPORT_BOTS } from "./battle/bots";
import {
  createCampaign,
  endWeek,
  lifeAction,
  nextCycle,
  syncBattle,
  type Campaign,
  type CampaignOptions,
} from "./campaign";
import { doctorPreview } from "./life/body";
import {
  advanceDay,
  findPlaced,
  placeCard,
  placementProblems,
  skipMeds,
  todayDose,
  unplaceCard,
  weekOver,
} from "./life/calendar";
import {
  LIFE_BOTS,
  placeFitting,
  planPlacements,
  type WeekPlan,
} from "./life/bots";
import type { LifeState } from "./life/types";
import { PARAMS } from "./params";
import { rngFromSeed, rngNext } from "./rng";
import type { BattleGrade, BattleOutcome, BattleState } from "./types";

// Headless whole-campaign players for balance checks: a week plan per week, a doctor policy, and
// the thoughtful battle player below for any battle.

export type DoctorPolicy = "early" | "late" | "never";

export interface CampaignPlan extends WeekPlan {
  readonly doctor: DoctorPolicy;
}

export type CampaignBot = (
  roll: () => number,
  life?: LifeState,
) => CampaignPlan;

const withDoctor =
  (bot: string, doctor: DoctorPolicy): CampaignBot =>
  (roll, life) => ({ ...LIFE_BOTS[bot](roll, life), doctor });

const POLICIES: readonly DoctorPolicy[] = ["early", "late", "never"];

export const CAMPAIGN_BOTS: Record<string, CampaignBot> = {
  home: withDoctor("home", "early"),
  /** Every risky card; sees the doctor, but late. */
  risky: withDoctor("risky", "late"),
  smarter: withDoctor("smarter", "early"),
  /** Coin flips for the cards and pills, and any doctor policy. */
  mixed: (roll, life) => ({
    ...LIFE_BOTS.mixed(roll, life),
    doctor: POLICIES[Math.floor(roll() * POLICIES.length)],
  }),
  /** Smarter cards, every dose skipped (a test bot: a player never chooses this). */
  skipMeds: withDoctor("smarterSkipMeds", "early"),
  /** Smarter versions, but the sleepover pills stay home and game night runs late. */
  forgetful: withDoctor("forgetful", "early"),
  /** The reference best plan by planned Choices, early doctor. */
  planner: withDoctor("planner", "early"),
  riskyDoctorEarly: withDoctor("risky", "early"),
  riskyNoDoctor: withDoctor("risky", "never"),
};

/** Risky versions, pills left, game night at Alex's, never the doctor. Kept out of CAMPAIGN_BOTS. */
export const careless: CampaignBot = withDoctor("careless", "never");

const RANK: Record<BattleGrade, number> = {
  cleared: 2,
  contained: 1,
  neededBackup: 0,
};

/** The better of the careful line and the charge line, charges spent eagerly. */
export function thoughtfulPlay(
  start: BattleState,
  seed: number,
): { outcome: BattleOutcome; final: BattleState } {
  const [a, b] = [BOTS.careful, BOTS.saveForCharge].map((bot) =>
    playBattle(bot, start, seed, SUPPORT_BOTS.eager),
  );
  const key = (o: BattleOutcome) => RANK[o.grade] * 100 + o.tissue.health;
  return key(b.outcome) > key(a.outcome) ? b : a;
}

function setLife(c: Campaign, life: LifeState): Campaign {
  return lifeAction(c, () => ({ state: life, events: [] })).state;
}

/**
 * Books the doctor once it is in hand: early policy on the first slot in the early window, late on
 * the first slot after it (else the last day). Empty slots first; if the energy will not stretch,
 * the cheapest card still to play is dropped and it tries again.
 */
function bookDoctor(life: LifeState, policy: DoctorPolicy): LifeState {
  if (policy === "never" || !life.hand.includes("doctor")) return life;
  if (findPlaced(life, "doctor")) return life;
  const until = doctorPreview(life).earlyUntil ?? life.day;
  const last = PARAMS.life.days - 1;
  const from =
    policy === "early"
      ? life.day
      : Math.min(last, Math.max(life.day, until + 1));
  const to = policy === "early" ? Math.min(last, until) : last;
  for (;;) {
    const slots: { day: number; slot: number; empty: boolean }[] = [];
    for (let day = from; day <= to; day++) {
      for (let slot = 0; slot < PARAMS.life.slotsPerDay; slot++)
        slots.push({ day, slot, empty: !life.plan[day][slot] });
    }
    slots.sort((x, y) => Number(y.empty) - Number(x.empty));
    const ok = slots.find(
      ({ day, slot }) =>
        placementProblems(life, day, slot, "doctor").length === 0,
    );
    if (ok) return placeCard(life, ok.day, ok.slot, "doctor").state;
    const cheapest = (["band", "game", "sleepover", "yard", "lake"] as const)
      .map((card) => findPlaced(life, card))
      .find((at) => at && at.day >= life.day);
    if (!cheapest) return life;
    life = unplaceCard(life, cheapest.day, cheapest.slot).state;
  }
}

/** Plays out the campaign's current week with `plan`, doctor policy included. */
export function playLifeWeek(c: Campaign, plan: CampaignPlan): Campaign {
  let life = placeFitting(c.life, planPlacements(plan));
  while (!weekOver(life)) {
    life = bookDoctor(life, plan.doctor);
    if (plan.skipMeds && todayDose(life)?.cause !== "friction")
      life = skipMeds(life).state;
    life = advanceDay(life).state;
  }
  return setLife(c, life);
}

/**
 * Plays a whole campaign with `bot`, every battle by thoughtfulPlay. Options as createCampaign
 * (seed aside), e.g. one week with reservoirs carried in.
 */
export function playCampaign(
  bot: CampaignBot,
  seed: number,
  opts: Omit<CampaignOptions, "seed"> = {},
  /** Called with each battle's opening state before it is played (for surveys). */
  onBattle?: (start: BattleState) => void,
): Campaign {
  let rng = rngFromSeed(seed * 31 + 7);
  const roll = () => {
    const r = rngNext(rng);
    rng = r.rng;
    return r.value;
  };
  let c = createCampaign({ ...opts, seed }).state;
  while (c.mode !== "done") {
    c = playLifeWeek(c, bot(roll, c.life));
    c = endWeek(c).state;
    if (c.mode === "battle") {
      onBattle?.(c.battle as BattleState);
      c = syncBattle(
        c,
        thoughtfulPlay(c.battle as BattleState, seed).final,
      ).state;
    }
    c = nextCycle(c).state;
  }
  return c;
}
