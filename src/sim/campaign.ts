import { battleStatus, gradeOutcome } from "./battle/outcome";
import { resolveTurn, turnProblems } from "./battle/resolve";
import { battleFromLoadout } from "./battle/setup";
import {
  aftermathKind,
  createLife,
  weekOver,
  weekStartEvents,
} from "./life/calendar";
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
import {
  campaignScore,
  weekScore,
  type CampaignScore,
  type WeekScore,
} from "./score";
import type {
  BattleGrade,
  BattleKind,
  BattleOutcome,
  BattleState,
  Contained,
  Order,
  SimEvent,
  SupportOrder,
} from "./types";

// The campaign (T13): life week -> battle (full, or a skirmish when nothing landed) -> outcome ->
// next week, for PARAMS.campaign.cycles weeks. Plain JSON like everything in the sim; every step returns the new
// state and the events to play. Rules and numbers are on PARAMS.campaign.

const C = PARAMS.campaign;

export type CampaignMode = "life" | "battle" | "outcome" | "done";

/** "quiet": the only week with no battle, a viral doctor visit with nothing landed. */
export type CycleResult =
  | { readonly kind: "quiet" }
  | {
      readonly kind: "battle";
      readonly battleKind: BattleKind;
      /** Empty for a skirmish. */
      readonly reasons: readonly BattleReason[];
      readonly outcome: BattleOutcome;
    };

/** One finished week, kept for the summary and the session log. */
export interface CycleRecord {
  readonly cycle: number;
  readonly week: number;
  readonly points: number;
  readonly goalMet: boolean;
  /** The goal the week was played against (13 unless ?goal= overrode it). */
  readonly goalTarget: number;
  readonly medLevel: number;
  /** Chance something new came home from the week's played rolls, 0..1 (display only). */
  readonly exposure: number;
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
  /** The week's score with every part named (see score.ts). */
  readonly score: WeekScore;
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
  /** The kind of the battle in play or just finished; null without one. */
  readonly battleKind: BattleKind | null;
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
      readonly battleKind: BattleKind;
      /** Empty for a skirmish. */
      readonly reasons: readonly BattleReason[];
      readonly hiddenTokens: number;
    }
  | {
      /** The doctor found only a virus and nothing landed: the one week with no battle. */
      readonly type: "QuietWeek";
      readonly cycle: number;
      readonly reason: "viral";
    }
  | {
      readonly type: "BattleEnded";
      readonly battleKind: BattleKind;
      readonly outcome: BattleOutcome;
    }
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
  /** Debug override of the goal target (?goal=N); later weeks inherit it. */
  readonly goalTarget?: number;
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
      goalTarget: opts.goalTarget,
    }),
    loadout: null,
    battleKind: null,
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

/**
 * Once the week is over: the full battle or the skirmish, or straight to a quiet outcome after a
 * viral doctor visit with nothing landed.
 */
export function endWeek(c: Campaign): CampaignStep {
  expectMode(c, "life");
  if (!weekOver(c.life)) throw new Error("the week is not over");
  const due = battleDue(c.life);
  if (!due.due) {
    return {
      state: { ...c, mode: "outcome", result: { kind: "quiet" } },
      events: [{ type: "QuietWeek", cycle: c.cycle, reason: "viral" }],
    };
  }
  const loadout: Loadout = {
    ...loadoutFromLife(c.life),
    residualKillChance: c.residualKillChance,
  };
  const battle = battleFromLoadout(loadout);
  return {
    state: { ...c, mode: "battle", loadout, battleKind: battle.kind, battle },
    events: [
      {
        type: "BattleStarted",
        battleKind: battle.kind,
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
      result: { kind: "battle", battleKind: battle.kind, reasons, outcome },
    },
    events: [
      ...events,
      { type: "BattleEnded", battleKind: battle.kind, outcome },
    ],
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

/**
 * What the outcome hands to the next week: reservoirs and energy (outcome or done mode). `next` is
 * before tiredness or a lost skirmish's aftermath, which the new week takes at its start.
 */
export function carryPreview(c: Campaign): CarryPreview {
  if (!c.result) throw new Error("no outcome yet");
  // A skirmish's board never holds a reservoir: the week's own carry on as they are.
  const found: readonly Contained[] =
    c.result.kind === "battle" && c.result.battleKind === "full"
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

/** A skirmish that ended with loose germs: the next week opens with its aftermath. */
const lostSkirmish = (r: CycleResult | null) =>
  r?.kind === "battle" &&
  r.battleKind === "skirmish" &&
  r.outcome.grade !== "cleared";

/** From the outcome: record the week, then start the next one with the carry, or finish. */
export function nextCycle(c: Campaign): CampaignStep {
  expectMode(c, "outcome");
  const carry = carryPreview(c);
  const life = c.life;
  const result = c.result as CycleResult;
  const record: CycleRecord = {
    cycle: c.cycle,
    week: life.week,
    points: life.goal.points,
    goalMet: life.goal.points >= life.goal.target,
    goalTarget: life.goal.target,
    medLevel: life.medLevel,
    exposure: 1 - life.rolls.reduce((none, r) => none * (1 - r.chance), 1),
    symptoms: life.symptoms,
    doctor: life.doctor,
    reservoirsIn: life.reservoirs.length,
    result,
    carried: carry.kept,
    dropped: carry.dropped,
    energyNext: carry.energy.next,
    score: weekScore(life, result, carry.kept.length),
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
      goalTarget: life.goal.target,
      aftermath: lostSkirmish(c.result)
        ? aftermathKind(c.seed, life.week + 1)
        : undefined,
    }),
    loadout: null,
    battleKind: null,
    battle: null,
    result: null,
    history,
  };
  return { state: next, events: [carried, ...weekStarted(next)] };
}

export interface CampaignSummary {
  readonly weeks: number;
  /** Weeks with no battle (a viral doctor visit, nothing landed). */
  readonly quietWeeks: number;
  /** Full battles by grade. */
  readonly grades: Readonly<Record<BattleGrade, number>>;
  readonly skirmishes: { readonly cleared: number; readonly loose: number };
  readonly tissueLost: number;
  readonly points: number;
  readonly goalsMet: number;
  readonly doctorVisits: number;
  readonly earlyVisits: number;
  /** Reservoirs still carried after the last finished week. */
  readonly reservoirsLeft: number;
  /** Choices and Outcome totals over the finished weeks. */
  readonly score: CampaignScore;
}

/** Totals over the finished weeks. */
export function campaignSummary(c: Campaign): CampaignSummary {
  const grades: Record<BattleGrade, number> = {
    cleared: 0,
    contained: 0,
    neededBackup: 0,
  };
  const skirmishes = { cleared: 0, loose: 0 };
  let tissueLost = 0;
  for (const h of c.history) {
    if (h.result.kind !== "battle") continue;
    if (h.result.battleKind === "skirmish")
      skirmishes[h.result.outcome.grade === "cleared" ? "cleared" : "loose"]++;
    else grades[h.result.outcome.grade]++;
    tissueLost += h.result.outcome.tissue.lost;
  }
  const visits = c.history.filter((h) => h.doctor);
  return {
    weeks: c.history.length,
    quietWeeks: c.history.filter((h) => h.result.kind === "quiet").length,
    grades,
    skirmishes,
    tissueLost,
    points: c.history.reduce((n, h) => n + h.points, 0),
    goalsMet: c.history.filter((h) => h.goalMet).length,
    doctorVisits: visits.length,
    earlyVisits: visits.filter((h) => h.doctor?.timing === "early").length,
    reservoirsLeft: c.history.at(-1)?.carried.length ?? 0,
    score: campaignScore(c.history.map((h) => h.score)),
  };
}
