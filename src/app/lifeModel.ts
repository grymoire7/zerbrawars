import { medLevelOf } from "../sim/life/meds";
import {
  findPlaced,
  medForecast,
  placementProblems,
  unplaceCard,
} from "../sim/life/calendar";
import { cardDef } from "../sim/life/cards";
import type { CardId, LifeEvent, LifeState } from "../sim/life/types";
import { bodyBeats } from "./campaignModel";
import { PARAMS } from "../sim/params";
import { pathogenKind, type PathogenKindId } from "../sim/pathogens";

// Pure helpers that turn life-phase state into plain words and numbers for the calendar UI and
// the body inset. Nothing here touches the DOM or three.js.

const L = PARAMS.life;
const EVENING = L.slotsPerDay - 1;

export const slotName = (slot: number) =>
  slot === EVENING ? "Evening" : "Daytime";

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "mold" or "bacterial": the silhouette family a pathogen is drawn as, as an adjective. */
export const kindNoun = (kind: PathogenKindId) =>
  pathogenKind(kind).form === "mold" ? "mold" : "bacterial";

/** Honest odds in words, e.g. "45% chance of a mold exposure". */
export function oddsText(chance: number, kind: PathogenKindId): string {
  return `${Math.round(chance * 100)}% chance of a ${kindNoun(kind)} exposure`;
}

const MAX_PARTICLES = 40;
const PARTICLES_PER_PATHOGEN = 30;

/** Preview dots for a card: proportional to the pathogens it brings on average, never 0 if risky. */
export function particleCount(expectedPathogens: number): number {
  if (expectedPathogens <= 0) return 0;
  return Math.min(
    MAX_PARTICLES,
    Math.max(1, Math.round(expectedPathogens * PARTICLES_PER_PATHOGEN)),
  );
}

/** Sim wording to warm, plain wording. Unknown messages pass through. */
export function friendlyProblem(problem: string): string {
  if (problem === "not enough energy") return "Not enough energy for this";
  if (problem === "that day is over") return "That day is already played";
  if (problem === "the week is over") return "The week is over";
  if (problem.startsWith("a sleepover needs"))
    return "A sleepover needs an evening with a day after it";
  const done = /is already on day (\d+)/.exec(problem);
  if (done) return `Already planned for day ${Number(done[1]) + 1}`;
  return problem;
}

export interface PlacementCheck {
  readonly day: number;
  readonly slot: number;
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

/**
 * Whether `card` can go in this slot. A card already on a future slot moves (the old spot is
 * cleared first), so only a played card or a real conflict blocks it.
 */
export function placementCheck(
  life: LifeState,
  day: number,
  slot: number,
  card: CardId,
  packPills: boolean,
): PlacementCheck {
  const at = findPlaced(life, card);
  const base =
    at && (at.day !== day || at.slot !== slot) && at.day >= life.day
      ? unplaceCard(life, at.day, at.slot).state
      : life;
  const reasons = placementProblems(base, day, slot, card, packPills).map(
    friendlyProblem,
  );
  return { day, slot, ok: reasons.length === 0, reasons };
}

export interface DoseCell {
  readonly day: number;
  readonly taken: boolean;
  /** Already decided (tapped, skipped, defaulted or lost) rather than a forecast. */
  readonly decided: boolean;
  readonly level: number;
  readonly why: string;
}

const WHY = {
  tapped: "taken",
  default: "taken",
  skipped: "skipped",
  friction: "pills in the other bag",
} as const;

/** Every day of the week: the dose as it stands (or is forecast) and the med level after it. */
export function doseStrip(life: LifeState): DoseCell[] {
  const cells: DoseCell[] = [];
  for (let day = 0; day < Math.min(life.day, L.days); day++) {
    const i = life.doses.findIndex(
      (d) => d.week === life.week && d.day === day,
    );
    if (i < 0) continue;
    const d = life.doses[i];
    cells.push({
      day,
      taken: d.taken,
      decided: true,
      level: medLevelOf(life.doses.slice(0, i + 1)),
      why: WHY[d.cause],
    });
  }
  if (life.day < L.days) {
    for (const f of medForecast(life)) {
      const decided = life.doses.some(
        (d) => d.week === life.week && d.day === f.day,
      );
      cells.push({
        day: f.day,
        taken: f.taken,
        decided,
        level: f.level,
        why: decided || !f.taken ? WHY[f.cause] : "planned",
      });
    }
  }
  return cells;
}

const labelOf = (card: CardId) => cardDef(card).label;

/** The day's events as short plain-language beats. */
export function lifeBeats(events: readonly LifeEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case "MedsTaken":
        out.push(
          e.cause === "tapped"
            ? `Meds taken. Streak: ${e.streak}.`
            : `Meds counted as taken. Streak: ${e.streak}.`,
        );
        break;
      case "MedsSkipped":
        out.push(
          e.cause === "friction"
            ? "That dose is missed."
            : "You skipped today's meds.",
        );
        break;
      case "CardPlayed":
        out.push(`${labelOf(e.card)}.`);
        break;
      case "GoalPoints":
        out.push(`+${e.points} toward the goal (${e.total} of ${e.target}).`);
        break;
      case "Rested":
        out.push("You took a breather and got some energy back.");
        break;
      case "ExposureRolled":
        out.push(
          e.landed
            ? `A ${kindNoun(e.kind)} exposure landed (it was a ${pct(e.chance)} chance).`
            : `No ${kindNoun(e.kind)} exposure this time (${pct(e.chance)} chance).`,
        );
        break;
      case "FrictionEvent":
        out.push(
          "Morning after the sleepover: the pills are in the other bag.",
        );
        break;
      case "MedLevelChanged":
        out.push(
          e.to < e.from
            ? `Medication level fell from ${pct(e.from)} to ${pct(e.to)}.`
            : `Medication level rose from ${pct(e.from)} to ${pct(e.to)}.`,
        );
        break;
      case "WeekEnded":
        out.push("The week is over.");
        break;
      default:
        out.push(...bodyBeats([e]));
        break;
    }
  }
  return out;
}

export interface WeekSummary {
  readonly landed: readonly { readonly text: string }[];
  readonly dodged: number;
  readonly medLevel: number;
  readonly streak: number;
  readonly points: number;
  readonly target: number;
  readonly metGoal: boolean;
}

/** What the week came to, for the end-of-week card. */
export function weekSummary(life: LifeState): WeekSummary {
  const groups = new Map<string, { card: CardId; kind: string; n: number }>();
  for (const x of life.exposures) {
    const key = `${x.day}:${x.slot}`;
    const g = groups.get(key) ?? { card: x.card, kind: kindNoun(x.kind), n: 0 };
    g.n += 1;
    groups.set(key, g);
  }
  return {
    landed: [...groups.values()].map((g) => ({
      text: `${labelOf(g.card)}: ${g.n} ${g.kind} exposure${g.n > 1 ? "s" : ""}`,
    })),
    dodged: life.rolls.filter((r) => !r.landed).length,
    medLevel: life.medLevel,
    streak: life.streak,
    points: life.goal.points,
    target: life.goal.target,
    metGoal: life.goal.points >= life.goal.target,
  };
}
