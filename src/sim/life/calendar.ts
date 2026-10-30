import { PARAMS } from "../params";
import { rngFromSeed, rngNext } from "../rng";
import { cardDef, HAND, placementCost } from "./cards";
import type { CarriedReservoir } from "./loadout";
import { medLevelOf, preWeekDoses, streakOf } from "./meds";
import type {
  CardId,
  Dose,
  LandedExposure,
  LifeEvent,
  LifeState,
  LifeStep,
  Placement,
} from "./types";

const L = PARAMS.life;
const EVENING = L.slotsPerDay - 1;

export interface LifeOptions {
  readonly seed: number;
  readonly week?: number;
  /** Energy to start with; defaults to PARAMS.life.startEnergy. */
  readonly energy?: number;
  readonly reservoirs?: readonly CarriedReservoir[];
  /** Dose history carried from an earlier week; defaults to a full window of taken doses. */
  readonly doses?: readonly Dose[];
}

export function createLife(opts: LifeOptions): LifeState {
  const week = opts.week ?? 1;
  const doses = opts.doses ?? preWeekDoses(week);
  return {
    schema: 1,
    seed: opts.seed,
    week,
    day: 0,
    hand: HAND,
    plan: Array.from({ length: L.days }, () =>
      Array.from({ length: L.slotsPerDay }, () => null),
    ),
    doses,
    streak: streakOf(doses),
    medLevel: medLevelOf(doses),
    goal: { points: 0, target: L.goalTarget },
    energy: Math.min(L.maxEnergy, opts.energy ?? L.startEnergy),
    rolls: [],
    exposures: [],
    reservoirs: opts.reservoirs ?? [],
    symptoms: [],
    flags: { frictionFired: false, doctorVisit: false },
    rng: rngFromSeed(opts.seed),
  };
}

export const weekOver = (life: LifeState) => life.day >= L.days;

/** Where a hand card sits on the calendar, if anywhere. */
export function findPlaced(
  life: LifeState,
  card: CardId,
): { day: number; slot: number; placement: Placement } | null {
  const base = cardDef(card).base;
  for (let day = 0; day < L.days; day++) {
    for (let slot = 0; slot < L.slotsPerDay; slot++) {
      const p = life.plan[day][slot];
      if (p && cardDef(p.card).base === base)
        return { day, slot, placement: p };
    }
  }
  return null;
}

/**
 * Energy after each remaining slot, in play order, starting from the current energy: a card costs
 * its energy (plus the pills if packed), a rest refunds PARAMS.life.restEnergy up to maxEnergy.
 * Index [d][s] is relative to `life.day`.
 */
export function energyPlan(
  life: LifeState,
  plan: LifeState["plan"] = life.plan,
): number[][] {
  let e = life.energy;
  const out: number[][] = [];
  for (let day = life.day; day < L.days; day++) {
    out.push(
      plan[day].map((p) => {
        e = p
          ? e - placementCost(p.card, p.packPills)
          : Math.min(L.maxEnergy, e + L.restEnergy);
        return e;
      }),
    );
  }
  return out;
}

function withPlacement(
  life: LifeState,
  day: number,
  slot: number,
  placement: Placement | null,
): LifeState["plan"] {
  return life.plan.map((row, d) =>
    row.map((p, s) => (d === day && s === slot ? placement : p)),
  );
}

function slotProblem(
  life: LifeState,
  day: number,
  slot: number,
): string | null {
  if (weekOver(life)) return "the week is over";
  if (!Number.isInteger(day) || day < 0 || day >= L.days)
    return `no day ${day}`;
  if (!Number.isInteger(slot) || slot < 0 || slot >= L.slotsPerDay) {
    return `no slot ${slot}`;
  }
  if (day < life.day) return "that day is over";
  return null;
}

/**
 * Why `card` cannot go in this slot (an empty list means placeCard will accept it). A card
 * already in the slot is replaced; the same hand card elsewhere on the calendar blocks it.
 */
export function placementProblems(
  life: LifeState,
  day: number,
  slot: number,
  card: CardId,
  packPills = false,
): string[] {
  const s = slotProblem(life, day, slot);
  if (s) return [s];
  const def = cardDef(card);
  const problems: string[] = [];
  if (!life.hand.includes(def.base))
    problems.push(`${def.base} is not in hand`);
  const at = findPlaced(life, card);
  if (at && (at.day !== day || at.slot !== slot)) {
    problems.push(`${def.base} is already on day ${at.day + 1}`);
  }
  if (def.overnight && (slot !== EVENING || day >= L.days - 1)) {
    problems.push("a sleepover needs an evening before another day");
  }
  const plan = withPlacement(life, day, slot, { card, packPills });
  if (energyPlan(life, plan).some((row) => row.some((e) => e < 0))) {
    problems.push("not enough energy");
  }
  return problems;
}

/** Puts a card (either version) in a slot, replacing whatever was there. Throws if not allowed. */
export function placeCard(
  life: LifeState,
  day: number,
  slot: number,
  card: CardId,
  packPills = false,
): LifeStep {
  const problems = placementProblems(life, day, slot, card, packPills);
  if (problems.length > 0) throw new Error(problems.join("; "));
  const old = life.plan[day][slot];
  const events: LifeEvent[] = [];
  if (old) events.push({ type: "CardRemoved", day, slot, card: old.card });
  events.push({ type: "CardPlaced", day, slot, card });
  return {
    state: {
      ...life,
      plan: withPlacement(life, day, slot, {
        card,
        packPills: packPills && !!cardDef(card).overnight,
      }),
    },
    events,
  };
}

export function unplaceCard(
  life: LifeState,
  day: number,
  slot: number,
): LifeStep {
  const s = slotProblem(life, day, slot);
  if (s) throw new Error(s);
  const old = life.plan[day][slot];
  if (!old) return { state: life, events: [] };
  return {
    state: { ...life, plan: withPlacement(life, day, slot, null) },
    events: [{ type: "CardRemoved", day, slot, card: old.card }],
  };
}

/** Packs (or unpacks) the pills for an overnight card already on the calendar. */
export function setPackPills(
  life: LifeState,
  day: number,
  slot: number,
  on: boolean,
): LifeStep {
  const p = life.plan[day]?.[slot];
  if (!p || !cardDef(p.card).overnight) {
    throw new Error("no overnight card in that slot");
  }
  return placeCard(life, day, slot, p.card, on);
}

/** Today's dose, once it is decided (tapped, skipped or lost to friction). */
export function todayDose(life: LifeState): Dose | null {
  return (
    life.doses.find((d) => d.week === life.week && d.day === life.day) ?? null
  );
}

function recordDose(life: LifeState, dose: Dose): LifeStep {
  const doses = [
    ...life.doses.filter((d) => !(d.week === dose.week && d.day === dose.day)),
    dose,
  ];
  const medLevel = medLevelOf(doses);
  const streak = streakOf(doses);
  const events: LifeEvent[] = [
    dose.taken
      ? {
          type: "MedsTaken",
          day: dose.day,
          cause: dose.cause as "tapped" | "default",
          streak,
        }
      : {
          type: "MedsSkipped",
          day: dose.day,
          cause: dose.cause as "skipped" | "friction",
        },
  ];
  if (medLevel !== life.medLevel) {
    events.push({ type: "MedLevelChanged", from: life.medLevel, to: medLevel });
  }
  return { state: { ...life, doses, medLevel, streak }, events };
}

function medsProblem(life: LifeState): string | null {
  if (weekOver(life)) return "the week is over";
  if (todayDose(life)?.cause === "friction") return "the pills are at home";
  return null;
}

/** The one-tap default. A day that ends untapped counts as taken anyway. */
export function takeMeds(life: LifeState): LifeStep {
  const p = medsProblem(life);
  if (p) throw new Error(p);
  return recordDose(life, {
    week: life.week,
    day: life.day,
    taken: true,
    cause: "tapped",
  });
}

export function skipMeds(life: LifeState): LifeStep {
  const p = medsProblem(life);
  if (p) throw new Error(p);
  return recordDose(life, {
    week: life.week,
    day: life.day,
    taken: false,
    cause: "skipped",
  });
}

/** The overnight card on the evening before `day` that left the pills at home, if any. */
export function frictionFor(life: LifeState, day: number): CardId | null {
  const p = day > 0 ? life.plan[day - 1][EVENING] : null;
  return p && cardDef(p.card).overnight && !p.packPills ? p.card : null;
}

/**
 * Ends the current day: an undecided dose is taken (the default), each slot plays in order
 * (points and energy for a card, a refund for a rest), then one roll per slot decides each card's
 * exposure. The next day then starts; a sleepover the night before without the pills packed
 * fires the friction event and that morning's dose is missed. After the last day, WeekEnded.
 */
export function advanceDay(life: LifeState): LifeStep {
  if (weekOver(life)) throw new Error("the week is over");
  const events: LifeEvent[] = [];
  let s = life;
  const day = s.day;
  if (!todayDose(s)) {
    const r = recordDose(s, {
      week: s.week,
      day,
      taken: true,
      cause: "default",
    });
    s = r.state;
    events.push(...r.events);
  }

  let energy = s.energy;
  let points = s.goal.points;
  let rng = s.rng;
  const rolls = [...s.rolls];
  const exposures: LandedExposure[] = [...s.exposures];
  for (let slot = 0; slot < L.slotsPerDay; slot++) {
    const p = s.plan[day][slot];
    const from = energy;
    const draw = rngNext(rng);
    rng = draw.rng;
    if (!p) {
      energy = Math.min(L.maxEnergy, energy + L.restEnergy);
      events.push({ type: "Rested", day, slot });
    } else {
      const def = cardDef(p.card);
      energy -= placementCost(p.card, p.packPills);
      points += def.points;
      events.push(
        { type: "CardPlayed", day, slot, card: p.card },
        {
          type: "GoalPoints",
          card: p.card,
          points: def.points,
          total: points,
          target: s.goal.target,
        },
      );
      const x = def.exposure;
      const roll = {
        day,
        slot,
        card: p.card,
        kind: x.kind,
        chance: x.chance,
        roll: draw.value,
        landed: draw.value < x.chance,
      };
      rolls.push(roll);
      events.push({
        type: "ExposureRolled",
        ...roll,
        size: x.size,
        count: x.count,
      });
      if (roll.landed) {
        for (let i = 0; i < x.count; i++) {
          exposures.push({
            day,
            slot,
            card: p.card,
            kind: x.kind,
            size: x.size,
          });
        }
      }
    }
    if (energy !== from)
      events.push({ type: "EnergyChanged", from, to: energy });
  }
  s = {
    ...s,
    day: day + 1,
    energy,
    goal: { ...s.goal, points },
    rng,
    rolls,
    exposures,
  };

  if (weekOver(s)) {
    events.push({
      type: "WeekEnded",
      battleDue: battleDueReasons(s).length > 0,
    });
    return { state: s, events };
  }
  events.push({ type: "DayStarted", day: s.day });
  const away = frictionFor(s, s.day);
  if (away) {
    events.push({ type: "FrictionEvent", day: s.day, card: away });
    const r = recordDose(s, {
      week: s.week,
      day: s.day,
      taken: false,
      cause: "friction",
    });
    s = { ...r.state, flags: { ...r.state.flags, frictionFired: true } };
    events.push(...r.events);
  }
  return { state: s, events };
}

/**
 * Why a battle follows this week: an exposure landed, or a carried reservoir flares. T13 owns
 * reservoir growth and flare timing; until then every carried reservoir flares.
 */
export function battleDueReasons(
  life: LifeState,
): ("exposure" | "reservoir")[] {
  const reasons: ("exposure" | "reservoir")[] = [];
  if (life.exposures.length > 0) reasons.push("exposure");
  if (life.reservoirs.length > 0) reasons.push("reservoir");
  return reasons;
}

export interface DoseForecast {
  readonly day: number;
  readonly taken: boolean;
  readonly cause: Dose["cause"];
  /** Med level once this day's dose is in. */
  readonly level: number;
}

/**
 * The dose and med level for each day from today to the week's end if the player keeps the
 * default: decided doses as they are, friction where an unpacked sleepover is planned, taken
 * otherwise. The last entry's level is what the battle gets.
 */
export function medForecast(life: LifeState): DoseForecast[] {
  const out: DoseForecast[] = [];
  let doses = [...life.doses];
  for (let day = life.day; day < L.days; day++) {
    const decided = doses.find((d) => d.week === life.week && d.day === day);
    const dose: Dose =
      decided ??
      (frictionFor(life, day)
        ? { week: life.week, day, taken: false, cause: "friction" }
        : { week: life.week, day, taken: true, cause: "default" });
    if (!decided) doses = [...doses, dose];
    out.push({
      day,
      taken: dose.taken,
      cause: dose.cause,
      level: medLevelOf(doses),
    });
  }
  return out;
}
