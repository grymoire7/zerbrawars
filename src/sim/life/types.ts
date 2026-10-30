import type { PathogenKindId } from "../pathogens";
import type { RngState } from "../rng";
import type { CarriedReservoir } from "./loadout";

// Life-phase state is plain JSON, like the battle: no classes, Maps or functions.

/** Every card version. The hand holds base cards; a smarter version replaces its base when placed. */
export type CardId =
  "yard" | "yardIndoor" | "lake" | "beach" | "band" | "sleepover";

/** The four cards dealt each week. */
export type HandCardId = "yard" | "lake" | "band" | "sleepover";

/** A card on the calendar. `packPills` only matters on an overnight card. */
export interface Placement {
  readonly card: CardId;
  readonly packPills: boolean;
}

/** One day's dose. Days before the week (pre-filled as taken) have week = this week - 1. */
export interface Dose {
  readonly week: number;
  /** 0-based day of that week. */
  readonly day: number;
  readonly taken: boolean;
  /** "default": nobody tapped, so the day ended with the dose taken. */
  readonly cause: "tapped" | "default" | "skipped" | "friction";
}

/** One exposure roll, made for every card when its day ends (landed or not). */
export interface ExposureRoll {
  readonly day: number;
  readonly slot: number;
  readonly card: CardId;
  readonly kind: PathogenKindId;
  readonly chance: number;
  /** The uniform roll; it landed if roll < chance. */
  readonly roll: number;
  readonly landed: boolean;
}

/** A pathogen an activity brought in. Becomes a Loadout exposure. */
export interface LandedExposure {
  readonly day: number;
  readonly slot: number;
  readonly card: CardId;
  readonly kind: PathogenKindId;
  readonly size: number;
}

/** T13 hook: a carried reservoir surfacing in the life phase. Nothing produces one yet. */
export interface Symptom {
  readonly kind: "lowFever";
  readonly day: number;
}

export interface LifeState {
  readonly schema: 1;
  readonly seed: number;
  /** 1-based; part of the battle seed. */
  readonly week: number;
  /** 0-based current day; equals PARAMS.life.days once the week is over. */
  readonly day: number;
  readonly hand: readonly HandCardId[];
  /** [day][slot] (slot 0 = day, 1 = evening); null = rest. */
  readonly plan: readonly (readonly (Placement | null)[])[];
  /** Every dose, oldest first, including the pre-week days that seed the window. */
  readonly doses: readonly Dose[];
  /** Doses taken in a row, up to and including the latest one. */
  readonly streak: number;
  /** 0..1, share of doses taken over the last PARAMS.life.meds.window days. */
  readonly medLevel: number;
  readonly goal: { readonly points: number; readonly target: number };
  /** Game-only resource. */
  readonly energy: number;
  readonly rolls: readonly ExposureRoll[];
  readonly exposures: readonly LandedExposure[];
  /** Carried in from an earlier battle (T13). */
  readonly reservoirs: readonly CarriedReservoir[];
  readonly symptoms: readonly Symptom[];
  readonly flags: {
    readonly frictionFired: boolean;
    /** T13: the doctor-visit card was played. */
    readonly doctorVisit: boolean;
  };
  /** Exposure rolls only: slotsPerDay draws at every day end, so placement never shifts them. */
  readonly rng: RngState;
}

export type LifeEvent =
  | { readonly type: "DayStarted"; readonly day: number }
  | {
      readonly type: "CardPlaced";
      readonly day: number;
      readonly slot: number;
      readonly card: CardId;
    }
  | {
      readonly type: "CardRemoved";
      readonly day: number;
      readonly slot: number;
      readonly card: CardId;
    }
  | {
      readonly type: "CardPlayed";
      readonly day: number;
      readonly slot: number;
      readonly card: CardId;
    }
  | {
      readonly type: "Rested";
      readonly day: number;
      readonly slot: number;
    }
  | {
      readonly type: "MedsTaken";
      readonly day: number;
      readonly cause: "tapped" | "default";
      readonly streak: number;
    }
  | {
      readonly type: "MedsSkipped";
      readonly day: number;
      readonly cause: "skipped" | "friction";
    }
  | {
      /** The sleepover's "pills are in the other bag": the next morning's dose is missed. */
      readonly type: "FrictionEvent";
      readonly day: number;
      readonly card: CardId;
    }
  | {
      readonly type: "MedLevelChanged";
      readonly from: number;
      readonly to: number;
    }
  | {
      readonly type: "EnergyChanged";
      readonly from: number;
      readonly to: number;
    }
  | ({ readonly type: "ExposureRolled" } & ExposureRoll & {
        readonly size: number;
        readonly count: number;
      })
  | {
      readonly type: "GoalPoints";
      readonly card: CardId;
      readonly points: number;
      readonly total: number;
      readonly target: number;
    }
  | { readonly type: "SymptomAppeared"; readonly symptom: Symptom }
  | {
      readonly type: "WeekEnded";
      readonly battleDue: boolean;
    };

export interface LifeStep {
  readonly state: LifeState;
  readonly events: readonly LifeEvent[];
}
