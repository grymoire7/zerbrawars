import { medForecast } from "./life/calendar";
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
  /** Doses taken this week. */
  readonly meds: number;
  /** Seeing the doctor, early or late, in a week a symptom showed. */
  readonly checked: number;
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
  const gain =
    pct(cardDef(def.base).exposure.chance) - pct(def.exposure.chance);
  const dodged =
    def.id === def.base || def.doctor
      ? 0
      : S.perDodgedPercent * Math.max(0, gain);
  return { living, dodged, total: living + dodged };
}

/** Choices from the finished week's life state. */
export function weekChoices(life: LifeState): ChoicesParts {
  const living = S.perPoint * life.goal.points;
  let dodged = 0;
  for (const r of life.rolls) {
    const def = cardDef(r.card);
    if (def.id === def.base) continue;
    const gain = pct(cardDef(def.base).exposure.chance) - pct(r.chance);
    dodged += S.perDodgedPercent * Math.max(0, gain);
  }
  const meds =
    S.perDose *
    life.doses.filter((d) => d.week === life.week && d.taken).length;
  const checked =
    life.symptoms.length > 0 && life.doctor ? S.checked[life.doctor.timing] : 0;
  return {
    living,
    dodged,
    meds,
    checked,
    total: living + dodged + meds + checked,
  };
}

/**
 * Choices if the calendar plays out as placed and every undecided dose defaults (taken, unless the
 * pills are in the other bag). For the live Score cell; the doctor bonus counts only once a visit
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
  const undecidedTaken = medForecast(life).filter(
    (f) =>
      f.taken &&
      !life.doses.some((d) => d.week === life.week && d.day === f.day),
  ).length;
  const meds = now.meds + S.perDose * undecidedTaken;
  return {
    living,
    dodged,
    meds,
    checked: now.checked,
    total: living + dodged + meds + now.checked,
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
