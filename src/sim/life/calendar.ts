import { PARAMS } from "../params";
import { rngFromSeed, rngNext } from "../rng";
import {
  bodyRoll,
  doctorCost,
  doctorTiming,
  flareChance,
  growthDayOf,
  scheduledSymptoms,
  toLifeReservoirs,
} from "./body";
import {
  cardDef,
  DOCTOR_CARD,
  exposureKind,
  HAND,
  placementCost,
} from "./cards";
import type { CarriedReservoir } from "./loadout";
import { medLevelOf, preWeekDoses, streakOf } from "./meds";
import type { BattleKind } from "../types";
import type {
  Aftermath,
  BattleReason,
  CardId,
  Dose,
  LandedExposure,
  LifeEvent,
  LifeReservoir,
  LifeState,
  LifeStep,
  Placement,
} from "./types";

const L = PARAMS.life;
const C = PARAMS.campaign;
const EVENING = L.slotsPerDay - 1;

export interface LifeOptions {
  readonly seed: number;
  readonly week?: number;
  /** Energy to start with; defaults to PARAMS.life.startEnergy. */
  readonly energy?: number;
  readonly reservoirs?: readonly CarriedReservoir[];
  /** Dose history carried from an earlier week; defaults to a full window of taken doses. */
  readonly doses?: readonly Dose[];
  /** Last week's skirmish ended with loose germs: the week opens with its aftermath. */
  readonly aftermath?: Aftermath["kind"];
}

/** Week 1 rolls from the seed itself; later weeks mix the week in so their dice differ. */
export function lifeRngSeed(seed: number, week: number): number {
  return week === 1
    ? seed
    : (Math.imul(seed ^ C.weekSalt, 0x9e3779b1) + week) >>> 0;
}

/**
 * The exposure roll of a card this week. The key is seed + week + the card's base id (not the
 * calendar slot and not the version), so moving a card, or swapping its version, on the same seed
 * never changes its luck: a replay changes only what the player changed.
 */
export function cardRoll(seed: number, week: number, card: CardId): number {
  const base = cardDef(card).base;
  let h = 0x811c9dc5;
  for (let i = 0; i < base.length; i++) {
    h = Math.imul(h ^ base.charCodeAt(i), 0x01000193);
  }
  let rng = rngFromSeed(
    (Math.imul(seed ^ C.diceSalt, 0x9e3779b1) +
      Math.imul(week, 0x85ebca6b) +
      Math.imul(h, 0xc2b2ae35)) >>>
      0,
  );
  rng = rngNext(rng).rng;
  return rngNext(rng).value;
}

/**
 * A fresh week. Carried reservoirs come in with their symptom day set; symptoms due on day 0
 * show at once (see weekStartEvents), and tiredness and a skirmish aftermath take their energy
 * now.
 */
export function createLife(opts: LifeOptions): LifeState {
  const week = opts.week ?? 1;
  const doses = opts.doses ?? preWeekDoses(week);
  const reservoirs = toLifeReservoirs(opts.reservoirs ?? []);
  const symptoms = scheduledSymptoms(opts.seed, week, reservoirs).filter(
    (s) => s.day === 0,
  );
  const tired = symptoms.some((s) => s.kind === "tired")
    ? C.symptoms.tiredEnergy
    : 0;
  const aftermath: Aftermath | null = opts.aftermath
    ? { kind: opts.aftermath, energy: C.skirmish.aftermathEnergy }
    : null;
  return {
    schema: 1,
    seed: opts.seed,
    week,
    day: 0,
    hand: symptoms.length > 0 ? [...HAND, DOCTOR_CARD] : HAND,
    plan: Array.from({ length: L.days }, () =>
      Array.from({ length: L.slotsPerDay }, () => null),
    ),
    doses,
    planned: Array.from({ length: L.days }, () => null),
    streak: streakOf(doses),
    medLevel: medLevelOf(doses),
    goal: { points: 0, target: L.goalTarget },
    energy: Math.max(
      0,
      Math.min(L.maxEnergy, opts.energy ?? L.startEnergy) -
        tired -
        (aftermath?.energy ?? 0),
    ),
    rolls: [],
    exposures: [],
    reservoirs,
    symptoms,
    aftermath,
    doctor: null,
    flags: { frictionFired: false, doctorVisit: false },
    rng: rngFromSeed(lifeRngSeed(opts.seed, week)),
  };
}

/** The events a fresh week opens with: a skirmish aftermath, then day 0's symptoms. */
export function weekStartEvents(life: LifeState): LifeEvent[] {
  return [
    ...(life.aftermath
      ? [{ type: "SkirmishAftermath" as const, aftermath: life.aftermath }]
      : []),
    ...life.symptoms
      .filter((s) => s.day === 0)
      .map((symptom) => ({ type: "SymptomAppeared" as const, symptom })),
  ];
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

/** Energy a planned slot costs: the card's (pills included), or the doctor's for that day. */
export function slotCost(life: LifeState, day: number, p: Placement): number {
  return cardDef(p.card).doctor
    ? doctorCost(life, day)
    : placementCost(p.card, p.packPills);
}

/**
 * Energy after each remaining slot, in play order, starting from the current energy: a card costs
 * slotCost, a rest refunds PARAMS.life.restEnergy up to maxEnergy. The doctor's viral refund is
 * not counted (nobody knows yet). Index [d][s] is relative to `life.day`.
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
          ? Math.min(L.maxEnergy, e - slotCost(life, day, p))
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

/** Why a day's dose cannot be set, or null when it can. */
function doseProblem(life: LifeState, day: number): string | null {
  if (weekOver(life)) return "the week is over";
  if (!Number.isInteger(day) || day < 0 || day >= L.days) {
    return "no such day";
  }
  if (day < life.day) return "that day is already played";
  if (day === life.day && todayDose(life)?.cause === "friction") {
    return "the pills are at home";
  }
  if (frictionFor(life, day)) return "the pills are at home";
  return null;
}

/**
 * DEBUG AND TEST ONLY: the player UI offers no way to skip a dose (doses are taken by routine; a
 * miss arises from life, like an unpacked sleepover). The debug panel's "force a missed dose"
 * and the test bots call this.
 *
 * Sets the planned dose for `day`, any day of the current week not yet played: true taken, false
 * skipped. It can be called again to change the choice, as often as wanted, until the day is
 * played. Today's choice lands in the dose history at once (and moves the med level); a later
 * day's waits in `planned` until that day starts. A day whose pills are in the other bag (an
 * unpacked sleepover the night before) is locked and throws. A day left undecided is taken when
 * it is played.
 */
export function setDose(
  life: LifeState,
  day: number,
  taken: boolean,
): LifeStep {
  const p = doseProblem(life, day);
  if (p) throw new Error(p);
  if (day === life.day) {
    const r = recordDose(life, {
      week: life.week,
      day,
      taken,
      cause: taken ? "tapped" : "skipped",
    });
    return r;
  }
  const planned = life.planned.map((v, i) => (i === day ? taken : v));
  return { state: { ...life, planned }, events: [] };
}

/** Takes today's dose (setDose for today). */
export const takeMeds = (life: LifeState): LifeStep =>
  setDose(life, life.day, true);

/** Skips today's dose (setDose for today). */
export const skipMeds = (life: LifeState): LifeStep =>
  setDose(life, life.day, false);

/** The overnight card on the evening before `day` that left the pills at home, if any. */
export function frictionFor(life: LifeState, day: number): CardId | null {
  const p = day > 0 ? life.plan[day - 1][EVENING] : null;
  return p && cardDef(p.card).overnight && !p.packPills ? p.card : null;
}

/**
 * Ends the current day: an undecided dose is taken (the default), each slot plays in order
 * (points and energy for a card, a refund for a rest, the visit for the doctor), then one roll per
 * slot decides each card's exposure. Then the body: an untreated reservoir at the end of its early
 * window grows, and each unflared one rolls its flare (both stop once the doctor is seen). The
 * next day then starts: its symptoms show (the first puts the doctor in hand), and a sleepover the
 * night before without the pills packed fires the friction event and that morning's dose is
 * missed. After the last day, WeekEnded.
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
  let reservoirs: LifeReservoir[] = [...s.reservoirs];
  let doctor = s.doctor;
  const rolls = [...s.rolls];
  const exposures: LandedExposure[] = [...s.exposures];
  for (let slot = 0; slot < L.slotsPerDay; slot++) {
    const p = s.plan[day][slot];
    const from = energy;
    // The week rng still advances once per slot (the week-end skirmish reads it), but exposure
    // dice come from cardRoll, keyed by card, not from this draw.
    rng = rngNext(rng).rng;
    if (!p) {
      energy = Math.min(L.maxEnergy, energy + L.restEnergy);
      events.push({ type: "Rested", day, slot });
    } else if (cardDef(p.card).doctor) {
      const finding = reservoirs.length > 0 ? "reservoir" : "viral";
      const cost = doctorCost(s, day);
      const refund = finding === "viral" ? C.doctor.viralRefund : 0;
      energy = Math.min(L.maxEnergy, energy - cost + refund);
      doctor = {
        day,
        slot,
        timing: doctorTiming(s, day),
        finding,
        energy: cost - refund,
      };
      const revealed = reservoirs.filter((r) => r.hidden).length;
      reservoirs = reservoirs.map((r) => ({ ...r, hidden: false }));
      events.push(
        { type: "CardPlayed", day, slot, card: p.card },
        { type: "DoctorVisited", ...doctor, revealed },
      );
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
        roll: cardRoll(s.seed, s.week, p.card),
        landed: cardRoll(s.seed, s.week, p.card) < x.chance,
      };
      rolls.push(roll);
      events.push({
        type: "ExposureRolled",
        ...roll,
        size: x.size,
        count: x.count,
        kinds: Array.from({ length: x.count }, (_, i) =>
          exposureKind(p.card, i),
        ),
      });
      if (roll.landed) {
        for (let i = 0; i < x.count; i++) {
          exposures.push({
            day,
            slot,
            card: p.card,
            kind: exposureKind(p.card, i),
            size: x.size,
          });
        }
      }
    }
    if (energy !== from)
      events.push({ type: "EnergyChanged", from, to: energy });
  }

  if (!doctor) {
    reservoirs = reservoirs.map((r, index) => {
      let next = r;
      if (day === growthDayOf(r) && r.size < PARAMS.maxPathogenSize) {
        const size = Math.min(PARAMS.maxPathogenSize, r.size + C.growth);
        next = { ...next, size, grown: true };
        events.push({ type: "ReservoirGrew", day, index, size });
      }
      if (!next.flared) {
        const chance = flareChance(day, next.size);
        if (bodyRoll(s.seed, s.week, day, index) < chance) {
          next = { ...next, flared: true };
          events.push({ type: "ReservoirFlared", day, index, chance });
        }
      }
      return next;
    });
  }

  s = {
    ...s,
    day: day + 1,
    energy,
    goal: { ...s.goal, points },
    rng,
    rolls,
    exposures,
    reservoirs,
    doctor,
    flags: { ...s.flags, doctorVisit: doctor !== null },
  };

  if (weekOver(s)) {
    const battleKind = battleKindOf(s);
    events.push({
      type: "WeekEnded",
      battleDue: battleKind !== null,
      battleKind,
    });
    return { state: s, events };
  }
  events.push({ type: "DayStarted", day: s.day });
  const today = scheduledSymptoms(s.seed, s.week, s.reservoirs).filter(
    (x) => x.day === s.day && !s.symptoms.some((y) => y.kind === x.kind),
  );
  if (today.length > 0) {
    s = {
      ...s,
      symptoms: [...s.symptoms, ...today],
      hand: s.hand.includes(DOCTOR_CARD) ? s.hand : [...s.hand, DOCTOR_CARD],
    };
    for (const symptom of today)
      events.push({ type: "SymptomAppeared", symptom });
  }
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
  } else if (s.planned[s.day] !== null) {
    const taken = s.planned[s.day] === true;
    const r = recordDose(s, {
      week: s.week,
      day: s.day,
      taken,
      cause: taken ? "tapped" : "skipped",
    });
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

/**
 * Why a full battle follows this week: an exposure landed, a carried reservoir flared, or the
 * doctor found a reservoir (the visit turns it into a fight on the player's terms). A viral visit
 * adds no reason.
 */
export function battleDueReasons(life: LifeState): BattleReason[] {
  const reasons: BattleReason[] = [];
  if (life.exposures.length > 0) reasons.push("exposure");
  if (life.reservoirs.some((r) => r.flared)) reasons.push("reservoir");
  if (life.doctor?.finding === "reservoir") reasons.push("doctor");
  return reasons;
}

/**
 * The week's battle as it stands: full with any reason, otherwise a skirmish (the body is always
 * on patrol), except after a viral doctor visit, which was the week's beat: null, no battle.
 */
export function battleKindOf(life: LifeState): BattleKind | null {
  if (battleDueReasons(life).length > 0) return "full";
  return life.doctor?.finding === "viral" ? null : "skirmish";
}

/** Which of last week's lost-skirmish aftermaths `week` opens with, fixed by seed and week. */
export function aftermathKind(seed: number, week: number): Aftermath["kind"] {
  return bodyRoll(seed, week, -2, 0) < 0.5 ? "wornOut" : "flareUp";
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
 * default: decided doses as they are, friction where an unpacked sleepover is planned, the
 * player's planned choice for a later day, taken otherwise. The last entry's level is what the battle gets.
 */
export function medForecast(life: LifeState): DoseForecast[] {
  const out: DoseForecast[] = [];
  let doses = [...life.doses];
  for (let day = life.day; day < L.days; day++) {
    const decided = doses.find((d) => d.week === life.week && d.day === day);
    const choice = life.planned[day];
    const dose: Dose =
      decided ??
      (frictionFor(life, day)
        ? { week: life.week, day, taken: false, cause: "friction" }
        : choice === null
          ? { week: life.week, day, taken: true, cause: "default" }
          : {
              week: life.week,
              day,
              taken: choice,
              cause: choice ? "tapped" : "skipped",
            });
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
