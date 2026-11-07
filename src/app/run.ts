import {
  createCampaign,
  endWeek,
  lifeAction,
  nextCycle,
  syncBattle,
  type Campaign,
  type CampaignEvent,
  type CampaignStep,
} from "../sim/campaign";
import { createLife } from "../sim/life/calendar";
import type { CarriedReservoir } from "../sim/life/loadout";
import type { LifeState, LifeStep } from "../sim/life/types";
import {
  appendEntry,
  createSessionLog,
  exportSessionLog,
  logStep,
  type SessionEntry,
  type SessionLog,
} from "../sim/sessionLog";
import type { BattleState, Order, SupportOrder } from "../sim/types";
import { PARAMS } from "../sim/params";
import { dosesForMed } from "./campaignModel";
import type { ArcId, VariantId } from "./arcs";

/** Facilitator switches, shared by every screen of a page session. */
export const settings = { brought: true, probe: false };

export interface RunOptions {
  readonly seed: number;
  /** Which arc and CGD variant this run belongs to (best scores key on them); default summer, xl. */
  readonly arc?: ArcId;
  readonly variant?: VariantId;
  readonly reservoirs?: readonly CarriedReservoir[];
  /** Debug start: the first week's med level, 0..1. */
  readonly med?: number;
  readonly energy?: number;
  /** Debug start: the goal target (?goal=N), in place of PARAMS.life.goalTarget. */
  readonly goalTarget?: number;
  /** ?mode=life: the calendar on its own, its battle a separate debug screen. */
  readonly standalone?: boolean;
  readonly now?: () => number;
}

export interface TurnInfo {
  readonly turn: number;
  readonly orders: readonly Order[];
  readonly support: SupportOrder | null;
  readonly planningMs: number;
  readonly playbackMs: number;
  readonly skipped: boolean;
  readonly replays: number;
  readonly speed: number;
}

/**
 * The campaign and its session log, held together so every step is logged as it is taken. The
 * Campaign is the one source of truth: screens read it and hand steps back through here.
 */
export interface Run {
  readonly standalone: boolean;
  readonly seed: number;
  readonly arc: ArcId;
  readonly variant: VariantId;
  campaign(): Campaign;
  /** Events of the latest step (a fresh week's opening symptoms, for one). */
  lastEvents(): readonly CampaignEvent[];
  log(): SessionLog;
  /** Milliseconds since the run began. */
  elapsed(): number;
  life(step: (l: LifeState) => LifeStep): CampaignStep;
  endWeek(): CampaignStep;
  /** Hands back the battle the controller resolved. */
  finishBattle(battle: BattleState): CampaignStep;
  next(): CampaignStep;
  turn(info: TurnInfo): void;
  probe(turn: number, note: string): void;
  ui(action: string, detail: string): void;
  exportJson(): string;
}

export function createRun(opts: RunOptions): Run {
  const now = opts.now ?? (() => performance.now());
  const t0 = now();
  const elapsed = () => Math.max(0, Math.round(now() - t0));
  const variant = opts.variant ?? "xl";
  const first = createCampaign({
    seed: opts.seed,
    residualKillChance: PARAMS.residualByVariant[variant],
    reservoirs: opts.reservoirs,
    energy: opts.energy,
    goalTarget: opts.goalTarget,
  });
  let campaign = first.state;
  if (opts.med !== undefined) {
    campaign = {
      ...campaign,
      life: createLife({
        seed: opts.seed,
        reservoirs: opts.reservoirs,
        energy: opts.energy,
        doses: dosesForMed(opts.med),
        goalTarget: opts.goalTarget,
      }),
    };
  }
  let events: readonly CampaignEvent[] = first.events;
  let log = logStep(
    createSessionLog(opts.seed, campaign.cycles, 0),
    { state: campaign, events: first.events },
    0,
  );
  const add = (e: SessionEntry) => {
    log = appendEntry(log, e);
  };
  const take = (step: CampaignStep): CampaignStep => {
    campaign = step.state;
    events = step.events;
    log = logStep(log, step, elapsed());
    return step;
  };
  return {
    standalone: opts.standalone ?? false,
    seed: opts.seed,
    arc: opts.arc ?? "summer",
    variant,
    campaign: () => campaign,
    lastEvents: () => events,
    log: () => log,
    elapsed,
    life: (step) => take(lifeAction(campaign, step)),
    endWeek: () => take(endWeek(campaign)),
    finishBattle: (battle) => take(syncBattle(campaign, battle)),
    next: () => take(nextCycle(campaign)),
    turn(info) {
      add({ t: elapsed(), cycle: campaign.cycle, type: "turn", ...info });
    },
    probe(turn, note) {
      add({
        t: elapsed(),
        cycle: campaign.cycle,
        type: "probe",
        turn,
        correct: null,
        note,
      });
    },
    ui(action, detail) {
      add({ t: elapsed(), type: "ui", action, detail });
    },
    exportJson: () => exportSessionLog(log),
  };
}
