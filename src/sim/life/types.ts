import type { PathogenKindId } from "../pathogens";
import type { RngState } from "../rng";
import type { BattleKind } from "../types";
import type { CarriedReservoir } from "./loadout";

// Life-phase state is plain JSON, like the battle: no classes, Maps or functions.

/** Every card version. The hand holds base cards; a smarter version replaces its base when placed. */
export type CardId =
  | "yard"
  | "yardIndoor"
  | "lake"
  | "beach"
  | "band"
  | "sleepover"
  | "game"
  | "gameEarly"
  | "doctor";

/** The five cards dealt each week, plus the doctor once a symptom shows. */
export type HandCardId =
  "yard" | "lake" | "band" | "sleepover" | "game" | "doctor";

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
  /**
   * "default": nobody tapped, so the day ended with the dose taken. "friction": the pills were left
   * at the sleepover. "slipped": a late night made the evening pills slip (no one's choice).
   */
  readonly cause: "tapped" | "default" | "skipped" | "friction" | "slipped";
}

/** One exposure roll, made for every card when its day ends (landed or not). */
export interface ExposureRoll {
  readonly day: number;
  readonly slot: number;
  readonly card: CardId;
  /** The card's main kind (see CardDef.exposure.kinds for a mix). */
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

/**
 * How the body shows a hidden reservoir (or a passing virus) in the life phase. A symptom never
 * says which: only the doctor can tell.
 */
export interface Symptom {
  readonly kind: "lowFever" | "soreSpot" | "tired";
  /** 0-based day whose morning it showed. */
  readonly day: number;
}

/** A carried reservoir during a life week. */
export interface LifeReservoir extends CarriedReservoir {
  /** The morning its symptom shows. */
  readonly symptomDay: number;
  /** Flared this week: a battle is due and it starts visible. */
  readonly flared: boolean;
  /** Grew this week (it went untreated past its early window). */
  readonly grown: boolean;
}

/**
 * How a lost skirmish (loose germs at its end) shows the next week: flavor only, not a symptom.
 * It never brings the doctor and says nothing about reservoirs.
 */
export interface Aftermath {
  readonly kind: "wornOut" | "flareUp";
  /** Energy it took at the week's start. */
  readonly energy: number;
}

export type DoctorTiming = "early" | "late";

/** A doctor visit that has happened this week. */
export interface DoctorVisit {
  readonly day: number;
  readonly slot: number;
  readonly timing: DoctorTiming;
  /** What the doctor found: a reservoir (now revealed), or only a passing virus. */
  readonly finding: "reservoir" | "viral";
  readonly energy: number;
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
  /**
   * Choices for days after today, set ahead of time: true taken, false skipped, null undecided
   * (the default, taken). A day's choice moves into `doses` when that day starts. Debug and test
   * only: the player UI never sets it (see setDose).
   */
  readonly planned: readonly (boolean | null)[];
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
  readonly reservoirs: readonly LifeReservoir[];
  /** Symptoms that have shown so far this week, in order. */
  readonly symptoms: readonly Symptom[];
  /** Left by last week's lost skirmish, or null. */
  readonly aftermath: Aftermath | null;
  readonly doctor: DoctorVisit | null;
  readonly flags: {
    readonly frictionFired: boolean;
    /** The doctor-visit card was played. */
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
      readonly cause: "skipped" | "friction" | "slipped";
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
        /** The kind of each pathogen it brings if it lands. */
        readonly kinds: readonly PathogenKindId[];
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
      /** Last week's skirmish ended with loose germs: flavor, not a symptom (see Aftermath). */
      readonly type: "SkirmishAftermath";
      readonly aftermath: Aftermath;
    }
  | ({ readonly type: "DoctorVisited" } & DoctorVisit & {
        /** Tokens the visit revealed. */
        readonly revealed: number;
      })
  | {
      /** An untreated reservoir grew at the end of its early window. */
      readonly type: "ReservoirGrew";
      readonly day: number;
      readonly index: number;
      readonly size: number;
    }
  | {
      /** A reservoir flared: the symptoms spike and a battle is due. */
      readonly type: "ReservoirFlared";
      readonly day: number;
      readonly index: number;
      readonly chance: number;
    }
  | {
      readonly type: "WeekEnded";
      /** Always true, except a viral doctor visit in a week where nothing landed. */
      readonly battleDue: boolean;
      readonly battleKind: BattleKind | null;
    };

export type BattleReason = "exposure" | "reservoir" | "doctor";

export interface LifeStep {
  readonly state: LifeState;
  readonly events: readonly LifeEvent[];
}
