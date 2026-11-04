import { medForecast, slipChanceFor } from "./life/calendar";
import { cardDef } from "./life/cards";
import type { CardId, LifeState } from "./life/types";
import { PARAMS } from "./params";
import type { CycleResult } from "./campaign";

// The score (B1a, docs/specs/b1a-design.md section 1). Pure: a finished week in, numbers out.
// Choices is what the player controls; Outcome includes the dice. Every weight is on PARAMS.score
// and nothing here ever goes below zero.

const S = PARAMS.score;

/** The Choices parts of one week. */
export interface ChoicesParts {
  /** Life points lived. */
  readonly living: number;
  /** Landing chance avoided by playing smarter versions of cards. */
  readonly dodged: number;
  /** Routine kept: doses the plan keeps safe (a slip chance counts against a dose, not the roll). */
  readonly meds: number;
  /** Seeing the doctor, early or late, in a week a symptom showed. */
  readonly checked: number;
  /** The life-points goal met: a flat bonus, zero otherwise. */
  readonly goalMet: number;
  readonly total: number;
}

/** The Outcome parts of one week. */
export interface OutcomeParts {
  /** Tissue health kept. */
  readonly tissue: number;
  /** The battle result. */
  readonly fight: number;
  /** Nothing carried over to the next week. */
  readonly clear: number;
  readonly total: number;
}

export interface WeekScore {
  readonly version: number;
  readonly choices: ChoicesParts;
  readonly outcome: OutcomeParts;
  readonly total: number;
}

export interface CampaignScore {
  readonly choices: number;
  readonly outcome: number;
  readonly total: number;
}

const pct = (chance: number) => Math.round(100 * chance);

/** Odds pushed for one card: the avoided landing chance (in points), rounded per card. */
const dodgedFor = (basePct: number, chosenPct: number) =>
  Math.round(S.perDodgedPercent * Math.max(0, basePct - chosenPct));

/**
 * How much of a dose the plan keeps safe: 1 for routine, 1 minus the slip chance for a late night,
 * 0 for a dose that is missed. Luck-free: a dose that did slip still counts as its forecast (the
 * real cost falls on Outcome through the battle). A forced or actual miss (friction, a skipped
 * dose, debug setDose) is 0 for that day; a debug-forced "taken" on a late-night day still carries
 * the late night's slip chance.
 */
function doseKept(
  life: LifeState,
  day: number,
  taken: boolean,
  cause: string,
): number {
  if (!taken && cause !== "slipped") return 0;
  return 1 - (slipChanceFor(life, day) ?? 0);
}

/**
 * What choosing a card adds to Choices: its life points, plus (for a smarter version) the landing
 * chance it avoids against its base card. No luck, so it is the same every week. The doctor card
 * adds nothing here: its bonus depends on the day and on what is found.
 */
export function cardChoices(card: CardId): {
  readonly living: number;
  readonly dodged: number;
  readonly total: number;
} {
  const def = cardDef(card);
  const living = S.perPoint * def.points;
  const dodged =
    def.id === def.base || def.doctor
      ? 0
      : dodgedFor(
          pct(cardDef(def.base).exposure.chance),
          pct(def.exposure.chance),
        );
  return { living, dodged, total: living + dodged };
}

/** Choices from the finished week's life state. */
export function weekChoices(life: LifeState): ChoicesParts {
  const living = S.perPoint * life.goal.points;
  let dodged = 0;
  for (const r of life.rolls) {
    const def = cardDef(r.card);
    if (def.id === def.base) continue;
    dodged += dodgedFor(pct(cardDef(def.base).exposure.chance), pct(r.chance));
  }
  const meds = Math.round(
    S.perDose *
      life.doses
        .filter((d) => d.week === life.week)
        .reduce((n, d) => n + doseKept(life, d.day, d.taken, d.cause), 0),
  );
  const checked =
    life.symptoms.length > 0 && life.doctor ? S.checked[life.doctor.timing] : 0;
  const goalMet = life.goal.points >= life.goal.target ? S.goal : 0;
  return {
    living,
    dodged,
    meds,
    checked,
    goalMet,
    total: living + dodged + meds + checked + goalMet,
  };
}

/**
 * Choices if the calendar plays out as placed and every undecided dose defaults (taken, unless the
 * pills are in the other bag; a late night counts its dose at one minus the slip chance). For the live Score cell; the doctor bonus counts only once a visit
 * has happened, so the planned figure can rise by up to that much, never fall.
 */
export function plannedChoices(life: LifeState): ChoicesParts {
  const now = weekChoices(life);
  let living = now.living;
  let dodged = now.dodged;
  for (let day = life.day; day < PARAMS.life.days; day++) {
    for (const p of life.plan[day]) {
      if (!p) continue;
      const c = cardChoices(p.card);
      living += c.living;
      dodged += c.dodged;
    }
  }
  const undecidedKept = medForecast(life)
    .filter(
      (f) => !life.doses.some((d) => d.week === life.week && d.day === f.day),
    )
    .reduce((n, f) => n + doseKept(life, f.day, f.taken, f.cause), 0);
  const meds = now.meds + Math.round(S.perDose * undecidedKept);
  const goalMet =
    living / S.perPoint >= life.goal.target ? S.goal : now.goalMet;
  return {
    living,
    dodged,
    meds,
    checked: now.checked,
    goalMet,
    total: living + dodged + meds + now.checked + goalMet,
  };
}

/** Outcome from the week's result and how many reservoirs carry into the next week. */
export function weekOutcome(
  result: CycleResult,
  carriedCount: number,
): OutcomeParts {
  let tissue: number;
  let fight: number;
  if (result.kind === "quiet") {
    tissue = S.perTissue * PARAMS.maxTissueHealth;
    fight = S.quiet;
  } else {
    tissue = S.perTissue * Math.max(0, result.outcome.tissue.health);
    fight =
      result.battleKind === "skirmish"
        ? result.outcome.grade === "cleared"
          ? S.skirmish.cleared
          : S.skirmish.loose
        : S.fight[result.outcome.grade];
  }
  const clear = Math.max(0, S.carryClear - S.perCarried * carriedCount);
  return { tissue, fight, clear, total: tissue + fight + clear };
}

export function weekScore(
  life: LifeState,
  result: CycleResult,
  carriedCount: number,
): WeekScore {
  const choices = weekChoices(life);
  const outcome = weekOutcome(result, carriedCount);
  return {
    version: S.version,
    choices,
    outcome,
    total: choices.total + outcome.total,
  };
}

/** Choices and Outcome totals over finished weeks. */
export function campaignScore(weeks: readonly WeekScore[]): CampaignScore {
  const choices = weeks.reduce((n, w) => n + w.choices.total, 0);
  const outcome = weeks.reduce((n, w) => n + w.outcome.total, 0);
  return { choices, outcome, total: choices + outcome };
}
