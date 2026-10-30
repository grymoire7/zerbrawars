import { PARAMS } from "../params";
import { pathogenKind } from "../pathogens";
import { rngFromSeed, rngNext } from "../rng";
import { chargesFor } from "../battle/setup";
import type { MedCharges } from "../types";
import type { CarriedReservoir } from "./loadout";
import type { DoctorTiming, LifeReservoir, LifeState, Symptom } from "./types";

// Carried reservoirs in the life phase (T13): symptoms, growth, flares and the doctor visit. The
// rules and numbers are documented on PARAMS.campaign.

const C = PARAMS.campaign;

/**
 * A uniform roll fixed by seed, week, day and index, so no placement or tap shifts it. Day -1 is
 * the week's own rolls (the viral fever).
 */
export function bodyRoll(
  seed: number,
  week: number,
  day: number,
  i: number,
): number {
  let rng = rngFromSeed(
    (Math.imul(seed ^ C.bodySalt, 0x9e3779b1) +
      Math.imul(week, 0x85ebca6b) +
      Math.imul(day + 2, 0xc2b2ae35) +
      Math.imul(i + 1, 0x27d4eb2f)) >>>
      0,
  );
  rng = rngNext(rng).rng;
  return rngNext(rng).value;
}

export function symptomDayFor(size: number): number {
  return size >= C.symptoms.earlySize
    ? C.symptoms.earlyDay
    : C.symptoms.lateDay;
}

/** The day an untreated reservoir grows: the end of its early window. */
export function growthDayOf(r: LifeReservoir): number {
  return r.symptomDay + C.doctor.earlyDays;
}

export function toLifeReservoirs(
  carried: readonly CarriedReservoir[],
): LifeReservoir[] {
  return carried.map((r) => ({
    ...r,
    symptomDay: symptomDayFor(r.size),
    flared: false,
    grown: false,
  }));
}

const SYMPTOM_ORDER: readonly Symptom["kind"][] = [
  "lowFever",
  "soreSpot",
  "tired",
];

/** This week's viral fever day, or null. Rolled from the seed and week alone. */
export function viralFeverDay(seed: number, week: number): number | null {
  if (bodyRoll(seed, week, -1, 0) >= C.symptoms.viralChance) return null;
  return Math.floor(bodyRoll(seed, week, -1, 1) * PARAMS.life.days);
}

/**
 * Every symptom the week will show, by day: one per reservoir kind (a mold as a low fever, a
 * bacterium as a sore spot, the earliest day wins), tiredness from day 0 if the carried total is
 * big enough, and the viral fever unless a reservoir fever shows that day or earlier.
 */
export function scheduledSymptoms(
  seed: number,
  week: number,
  reservoirs: readonly LifeReservoir[],
): Symptom[] {
  const out: Symptom[] = [];
  const add = (s: Symptom) => {
    const same = out.find((o) => o.kind === s.kind);
    if (!same) out.push(s);
    else if (s.day < same.day) out[out.indexOf(same)] = s;
  };
  for (const r of reservoirs) {
    add({
      kind: pathogenKind(r.kind).form === "mold" ? "lowFever" : "soreSpot",
      day: r.symptomDay,
    });
  }
  const total = reservoirs.reduce((n, r) => n + r.size, 0);
  if (total >= C.symptoms.tiredTotal) add({ kind: "tired", day: 0 });
  const viral = viralFeverDay(seed, week);
  if (viral !== null) add({ kind: "lowFever", day: viral });
  return out.sort(
    (a, b) =>
      a.day - b.day ||
      SYMPTOM_ORDER.indexOf(a.kind) - SYMPTOM_ORDER.indexOf(b.kind),
  );
}

/** Early if within PARAMS.campaign.doctor.earlyDays of the first symptom, else late. */
export function doctorTiming(life: LifeState, day: number): DoctorTiming {
  const first = life.symptoms[0]?.day ?? day;
  return day <= first + C.doctor.earlyDays ? "early" : "late";
}

export function doctorCost(life: LifeState, day: number): number {
  return doctorTiming(life, day) === "early"
    ? C.doctor.earlyEnergy
    : C.doctor.lateEnergy;
}

/** A carried reservoir's flare chance at the end of `day`. */
export function flareChance(day: number, size: number): number {
  return Math.min(
    1,
    Math.max(0, C.flare.perDay * (day + 1) + C.flare.perSize * (size - 1)),
  );
}

export interface DoctorPreview {
  /** In hand: a symptom has shown. */
  readonly available: boolean;
  /** Early or late if seen on `day`, and its energy. */
  readonly timing: DoctorTiming;
  readonly energy: number;
  /** The last day that still counts as early, or null before any symptom. */
  readonly earlyUntil: number | null;
  /** Energy back if it turns out to be only a virus. */
  readonly viralRefund: number;
  /** Charges the next battle gets with the visit, med charges included. */
  readonly charges: MedCharges;
}

/**
 * The doctor card's face for a visit on `day` (default today). It never says whether anything
 * is hiding: the visit is how the player finds out.
 */
export function doctorPreview(
  life: LifeState,
  day: number = life.day,
): DoctorPreview {
  const first = life.symptoms[0]?.day;
  return {
    available: life.hand.includes("doctor"),
    timing: doctorTiming(life, day),
    energy: doctorCost(life, day),
    earlyUntil: first === undefined ? null : first + C.doctor.earlyDays,
    viralRefund: C.doctor.viralRefund,
    charges: chargesFor(life.medLevel, true),
  };
}
