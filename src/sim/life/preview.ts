import type { PathogenKindId } from "../pathogens";
import { PARAMS } from "../params";
import { chargesFor } from "../battle/setup";
import type { MedCharges } from "../types";
import { cardDef, exposureKind, placementCost } from "./cards";
import { frictionFor, medForecast, weekOver } from "./calendar";
import type { CardId, LifeState } from "./types";

export interface CardPreview {
  readonly card: CardId;
  readonly label: string;
  readonly people: string;
  readonly blurb: string;
  readonly points: number;
  readonly energy: number;
  /** The main kind; `kinds` lists each pathogen it brings (the lake brings strep and staph). */
  readonly kind: PathogenKindId;
  readonly kinds: readonly PathogenKindId[];
  /** Odds the exposure lands, as rolled. */
  readonly chance: number;
  /** Size and number of pathogens if it lands. */
  readonly size: number;
  readonly count: number;
  /** chance * count: pathogens brought in on average (the inset's particle density). */
  readonly expectedPathogens: number;
  /** The other version of the same hand card, if any. */
  readonly otherVersion: CardId | null;
  readonly smarter: boolean;
  /** Overnight cards: what packing the pills costs, and that the next dose is lost otherwise. */
  readonly friction: { readonly packPillsEnergy: number } | null;
  /** A late-night card: the chance that day's evening pills slip. Null for every other card. */
  readonly doseRisk: { readonly chance: number; readonly text: string } | null;
}

/** Everything a card's face and hover need, before committing to it. */
export function cardPreview(_life: LifeState, card: CardId): CardPreview {
  const d = cardDef(card);
  const base = cardDef(d.base);
  const other = d.id === d.base ? (d.smarter ?? null) : d.base;
  return {
    card,
    label: d.label,
    people: d.people,
    blurb: d.blurb,
    points: d.points,
    energy: d.energy,
    kind: d.exposure.kind,
    kinds: Array.from({ length: d.exposure.count }, (_, i) =>
      exposureKind(card, i),
    ),
    chance: d.exposure.chance,
    size: d.exposure.size,
    count: d.exposure.count,
    expectedPathogens: d.exposure.chance * d.exposure.count,
    otherVersion: other,
    smarter: d.id !== base.id,
    friction: d.overnight
      ? { packPillsEnergy: placementCost(card, true) - d.energy }
      : null,
    doseRisk: d.lateNight
      ? {
          chance: PARAMS.life.meds.slip.lateNight,
          text: `late night: ${Math.round(PARAMS.life.meds.slip.lateNight * 100)}% the pills slip`,
        }
      : null,
  };
}

export interface WeekPreview {
  /** Placed cards still to play, in play order, with their odds. */
  readonly pending: readonly {
    readonly day: number;
    readonly slot: number;
    readonly preview: CardPreview;
  }[];
  /** Pathogens already in from days that ended. */
  readonly landed: number;
  /** Chance at least one more exposure lands. */
  readonly chanceAnyExposure: number;
  /**
   * Chance the week ends in a full battle rather than a skirmish, from what the player can know:
   * exposures landed or still to roll, a reservoir that flared, or a doctor visit that found one.
   * Hidden reservoirs that have not flared are left out, so the number never gives them away.
   */
  readonly chanceBattle: number;
  readonly expectedPathogens: Readonly<Record<PathogenKindId, number>>;
  readonly points: { readonly planned: number; readonly target: number };
  /** Med level at week end if the defaults hold (friction included), and its charges. */
  readonly medLevel: number;
  readonly charges: MedCharges;
  /** Days whose morning dose is planned to be lost to friction. */
  readonly frictionDays: readonly number[];
  /** Days whose dose has a chance to slip (a late-night card), with that chance. */
  readonly slipDays: readonly {
    readonly day: number;
    readonly chance: number;
  }[];
}

/** The whole week's odds and consequences as the calendar stands. */
export function exposurePreview(life: LifeState): WeekPreview {
  const pending: WeekPreview["pending"][number][] = [];
  const expected: Record<PathogenKindId, number> = {
    strep: 0,
    aspergillus: 0,
    staph: 0,
  };
  for (const e of life.exposures) expected[e.kind] += 1;
  let none = 1;
  let planned = life.goal.points;
  for (let day = life.day; day < PARAMS.life.days; day++) {
    life.plan[day].forEach((p, slot) => {
      if (!p) return;
      const preview = cardPreview(life, p.card);
      pending.push({ day, slot, preview });
      none *= 1 - preview.chance;
      for (const k of preview.kinds) expected[k] += preview.chance;
      planned += preview.points;
    });
  }
  const certain =
    life.exposures.length > 0 ||
    life.reservoirs.some((r) => r.flared) ||
    life.doctor?.finding === "reservoir";
  const forecast = medForecast(life);
  const medLevel = weekOver(life)
    ? life.medLevel
    : forecast[forecast.length - 1].level;
  const frictionDays: number[] = [];
  for (let day = Math.max(1, life.day); day < PARAMS.life.days; day++) {
    if (frictionFor(life, day)) frictionDays.push(day);
  }
  const slipDays = forecast.flatMap((f) =>
    f.chance === null ? [] : [{ day: f.day, chance: f.chance }],
  );
  return {
    pending,
    landed: life.exposures.length,
    chanceAnyExposure: 1 - none,
    chanceBattle: certain ? 1 : 1 - none,
    expectedPathogens: expected,
    points: { planned, target: life.goal.target },
    medLevel,
    charges: chargesFor(medLevel, life.flags.doctorVisit),
    frictionDays,
    slipDays,
  };
}
