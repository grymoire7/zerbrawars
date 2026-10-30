import { battleStatus, gradeOutcome } from "./battle/outcome";
import { resolveTurn, turnProblems } from "./battle/resolve";
import { battleFromLoadout } from "./battle/setup";
import { createLife, weekOver, weekStartEvents } from "./life/calendar";
import {
  battleDue,
  loadoutFromLife,
  type CarriedReservoir,
  type Loadout,
} from "./life/loadout";
import type {
  BattleReason,
  DoctorVisit,
  LifeEvent,
  LifeState,
  LifeStep,
  Symptom,
} from "./life/types";
import { PARAMS } from "./params";
import type {
  BattleGrade,
  BattleOutcome,
  BattleState,
  Contained,
  Order,
  SimEvent,
  SupportOrder,
} from "./types";

// The campaign (T13): life week -> battle (only if one is due) -> outcome -> next week, for
// PARAMS.campaign.cycles weeks. Plain JSON like everything in the sim; every step returns the new
// state and the events to play. Rules and numbers are on PARAMS.campaign.

const C = PARAMS.campaign;

export type CampaignMode = "life" | "battle" | "outcome" | "done";

export type CycleResult =
  | { readonly kind: "quiet" }
  | {
      readonly kind: "battle";
      readonly reasons: readonly BattleReason[];
      readonly outcome: BattleOutcome;
    };

/** One finished week, kept for the summary and the session log. */
export interface CycleRecord {
  readonly cycle: number;
  readonly week: number;
  readonly points: number;
  readonly goalMet: boolean;
  readonly medLevel: number;
  readonly symptoms: readonly Symptom[];
  readonly doctor: DoctorVisit | null;
  /** Reservoirs the week started with. */
  readonly reservoirsIn: number;
  readonly result: CycleResult;
  /** What carries into the next week (or is left at the end). */
  readonly carried: readonly CarriedReservoir[];
  /** Reservoirs over the cap, cleared at the carry. */
  readonly dropped: readonly Contained[];
  /** Energy the next week starts with, before any tiredness. */
  readonly energyNext: number;
}

export interface Campaign {
  readonly schema: 1;
  readonly seed: number;
  readonly cycles: number;
  /** 1-based week of the campaign. */
  readonly cycle: number;
  readonly mode: CampaignMode;
  /** Per-character residual oxidase activity, for every battle. */
  readonly residualKillChance: number;
  readonly life: LifeState;
  /** The battle's loadout, from the week that just ended; null in life mode. */
  readonly loadout: Loadout | null;
  /** The battle in play, or as it ended (outcome mode); null without one. */
  readonly battle: BattleState | null;
  /** Set in outcome mode (and kept in done mode for the last week). */
  readonly result: CycleResult | null;
  readonly history: readonly CycleRecord[];
}

export type CampaignEvent =
  | { readonly type: "Life"; readonly event: LifeEvent }
  | { readonly type: "Battle"; readonly event: SimEvent }
  | {
      readonly type: "WeekStarted";
      readonly cycle: number;
      readonly week: number;
      readonly energy: number;
      /** Carried reservoirs, all hidden: the UI shows only that the body feels off (symptoms). */
      readonly reservoirs: number;
    }
  | {
      readonly type: "BattleStarted";
      readonly reasons: readonly BattleReason[];
      readonly hiddenTokens: number;
    }
  | {
      /** Nothing landed, flared or needed the doctor: no battle this week. */
      readonly type: "QuietWeek";
      readonly cycle: number;
    }
  | { readonly type: "BattleEnded"; readonly outcome: BattleOutcome }
  | {
      readonly type: "Carried";
      readonly kept: readonly CarriedReservoir[];
      readonly dropped: readonly Contained[];
      readonly energy: { readonly from: number; readonly to: number };
    }
  | { readonly type: "CampaignEnded"; readonly summary: CampaignSummary };

export interface CampaignStep {
  readonly state: Campaign;
  readonly events: readonly CampaignEvent[];
}

export interface CampaignOptions {
  readonly seed: number;
  readonly cycles?: number;
  readonly residualKillChance?: number;
  /** First week only, for the debug panel and tests: reservoirs carried in and starting energy. */
  readonly reservoirs?: readonly CarriedReservoir[];
  readonly energy?: number;
}

const lifeEvents = (events: readonly LifeEvent[]): CampaignEvent[] =>
  events.map((event) => ({ type: "Life", event }));

function weekStarted(c: Campaign): CampaignEvent[] {
  return [
    {
      type: "WeekStarted",
      cycle: c.cycle,
      week: c.life.week,
      energy: c.life.energy,
      reservoirs: c.life.reservoirs.length,
    },
    ...lifeEvents(weekStartEvents(c.life)),
  ];
}

export function createCampaign(opts: CampaignOptions): CampaignStep {
  const state: Campaign = {
    schema: 1,
    seed: opts.seed,
    cycles: opts.cycles ?? C.cycles,
    cycle: 1,
    mode: "life",
    residualKillChance: opts.residualKillChance ?? PARAMS.residualKillChance,
    life: createLife({
      seed: opts.seed,
      week: 1,
      reservoirs: opts.reservoirs?.slice(0, C.carry.maxReservoirs),
      energy: opts.energy,
    }),
    loadout: null,
    battle: null,
    result: null,
    history: [],
  };
  return { state, events: weekStarted(state) };
}

function expectMode(c: Campaign, mode: CampaignMode): void {
  if (c.mode !== mode) throw new Error(`not in ${mode} mode (${c.mode})`);
}

/** Applies a life-phase step (placeCard, takeMeds, advanceDay, ...) to the campaign's week. */
export function lifeAction(
  c: Campaign,
  step: (life: LifeState) => LifeStep,
): CampaignStep {
  expectMode(c, "life");
  const r = step(c.life);
  return { state: { ...c, life: r.state }, events: lifeEvents(r.events) };
}

/** Once the week is over: the battle if one is due, else straight to a quiet outcome. */
export function endWeek(c: Campaign): CampaignStep {
  expectMode(c, "life");
  if (!weekOver(c.life)) throw new Error("the week is not over");
  const due = battleDue(c.life);
  if (!due.due) {
    return {
      state: { ...c, mode: "outcome", result: { kind: "quiet" } },
      events: [{ type: "QuietWeek", cycle: c.cycle }],
    };
  }
  const loadout: Loadout = {
    ...loadoutFromLife(c.life),
    residualKillChance: c.residualKillChance,
  };
  const battle = battleFromLoadout(loadout);
  return {
    state: { ...c, mode: "battle", loadout, battle },
    events: [
      {
        type: "BattleStarted",
        reasons: due.reasons,
        hiddenTokens: battle.pathogens.filter((p) => p.hidden).length,
      },
    ],
  };
}

function withBattle(
  c: Campaign,
  battle: BattleState,
  events: CampaignEvent[],
): CampaignStep {
  if (!battleStatus(battle).over) return { state: { ...c, battle }, events };
  const outcome = gradeOutcome(battle);
  const reasons = battleDue(c.life).reasons;
  return {
    state: {
      ...c,
      battle,
      mode: "outcome",
      result: { kind: "battle", reasons, outcome },
    },
    events: [...events, { type: "BattleEnded", outcome }],
  };
}

/** Resolves one battle turn; once the battle is over the campaign moves to its outcome. */
export function battleTurn(
  c: Campaign,
  orders: readonly Order[],
  support: SupportOrder | null = null,
): CampaignStep {
  expectMode(c, "battle");
  const battle = c.battle as BattleState;
  const problems = turnProblems(battle, orders, support);
  if (problems.length > 0) throw new Error(problems.join("; "));
  const r = resolveTurn(battle, orders, support);
  return withBattle(
    c,
    r.state,
    r.events.map((event) => ({ type: "Battle", event })),
  );
}

/**
 * Hands back a battle the UI resolved itself (its controller owns turns, undo and replay). The
 * campaign takes it as is and moves to the outcome once it is over.
 */
export function syncBattle(c: Campaign, battle: BattleState): CampaignStep {
  expectMode(c, "battle");
  return withBattle(c, battle, []);
}

/**
 * Carry rule: biggest first (ties keep the given order: loads, granulomas, hidden tokens), at most
 * PARAMS.campaign.carry.maxReservoirs kept, each cut to carry.maxSize and hidden. The rest drop.
 */
export function carryReservoirs(found: readonly Contained[]): {
  kept: CarriedReservoir[];
  dropped: Contained[];
} {
  const order = found
    .map((r, i) => ({ r, i }))
    .sort((a, b) => b.r.size - a.r.size || a.i - b.i)
    .map(({ r }) => ({ kind: r.kind, size: r.size }));
  return {
    kept: order.slice(0, C.carry.maxReservoirs).map((r) => ({
      kind: r.kind,
      size: Math.min(C.carry.maxSize, r.size),
      hidden: true,
    })),
    dropped: order.slice(C.carry.maxReservoirs),
  };
}

export interface CarryPreview {
  readonly kept: readonly CarriedReservoir[];
  readonly dropped: readonly Contained[];
  readonly energy: {
    readonly left: number;
    readonly recovery: number;
    readonly outcome: number;
    readonly next: number;
  };
}

/** What the outcome hands to the next week: reservoirs and energy (outcome or done mode). */
export function carryPreview(c: Campaign): CarryPreview {
  if (!c.result) throw new Error("no outcome yet");
  const found: readonly Contained[] =
    c.result.kind === "battle"
      ? c.result.outcome.reservoirs
      : c.life.reservoirs;
  const outcome =
    c.result.kind === "battle" ? c.result.outcome.energy : C.quietWeekEnergy;
  const left = c.life.energy;
  return {
    ...carryReservoirs(found),
    energy: {
      left,
      recovery: C.weekRecovery,
      outcome,
      next: Math.min(PARAMS.life.maxEnergy, left + C.weekRecovery + outcome),
    },
  };
}

/** From the outcome: record the week, then start the next one with the carry, or finish. */
export function nextCycle(c: Campaign): CampaignStep {
  expectMode(c, "outcome");
  const carry = carryPreview(c);
  const life = c.life;
  const record: CycleRecord = {
    cycle: c.cycle,
    week: life.week,
    points: life.goal.points,
    goalMet: life.goal.points >= life.goal.target,
    medLevel: life.medLevel,
    symptoms: life.symptoms,
    doctor: life.doctor,
    reservoirsIn: life.reservoirs.length,
    result: c.result as CycleResult,
    carried: carry.kept,
    dropped: carry.dropped,
    energyNext: carry.energy.next,
  };
  const history = [...c.history, record];
  const carried: CampaignEvent = {
    type: "Carried",
    kept: carry.kept,
    dropped: carry.dropped,
    energy: { from: life.energy, to: carry.energy.next },
  };
  if (c.cycle >= c.cycles) {
    const done: Campaign = { ...c, mode: "done", history };
    return {
      state: done,
      events: [
        carried,
        { type: "CampaignEnded", summary: campaignSummary(done) },
      ],
    };
  }
  const next: Campaign = {
    ...c,
    cycle: c.cycle + 1,
    mode: "life",
    life: createLife({
      seed: c.seed,
      week: life.week + 1,
      energy: carry.energy.next,
      reservoirs: carry.kept,
      doses: life.doses,
    }),
    loadout: null,
    battle: null,
    result: null,
    history,
  };
  return { state: next, events: [carried, ...weekStarted(next)] };
}

export interface CampaignSummary {
  readonly weeks: number;
  readonly quietWeeks: number;
  readonly grades: Readonly<Record<BattleGrade, number>>;
  readonly tissueLost: number;
  readonly points: number;
  readonly goalsMet: number;
  readonly doctorVisits: number;
  readonly earlyVisits: number;
  /** Reservoirs still carried after the last finished week. */
  readonly reservoirsLeft: number;
}

/** Totals over the finished weeks. */
export function campaignSummary(c: Campaign): CampaignSummary {
  const grades: Record<BattleGrade, number> = {
    cleared: 0,
    contained: 0,
    neededBackup: 0,
  };
  let tissueLost = 0;
  for (const h of c.history) {
    if (h.result.kind !== "battle") continue;
    grades[h.result.outcome.grade]++;
    tissueLost += h.result.outcome.tissue.lost;
  }
  const visits = c.history.filter((h) => h.doctor);
  return {
    weeks: c.history.length,
    quietWeeks: c.history.filter((h) => h.result.kind === "quiet").length,
    grades,
    tissueLost,
    points: c.history.reduce((n, h) => n + h.points, 0),
    goalsMet: c.history.filter((h) => h.goalMet).length,
    doctorVisits: visits.length,
    earlyVisits: visits.filter((h) => h.doctor?.timing === "early").length,
    reservoirsLeft: c.history.at(-1)?.carried.length ?? 0,
  };
}
