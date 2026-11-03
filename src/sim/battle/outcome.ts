import { PARAMS } from "../params";
import type {
  BattleGrade,
  BattleOutcome,
  BattleState,
  BattleStatus,
  Reservoir,
} from "../types";

/** Visible pathogens still on the board. Hidden tokens are reservoirs, not free. */
export function freePathogens(battle: BattleState): number {
  return battle.pathogens.filter((p) => !p.hidden).length;
}

/**
 * A sealed germ carried inside a swarm is "alive inside" (its carried-load residual roll goes on
 * each turn). Walled-off contents are not: a granuloma holds them for good.
 */
export function aliveInside(battle: BattleState): number {
  return battle.swarms.reduce((n, s) => n + s.load.length, 0);
}

/**
 * Over once tissue health reaches the backup line (backup arrives at once), once "all clear" (no
 * visible pathogen on the board, nothing alive inside a swarm and no arrival still due; a swallowed
 * sealed germ keeps the fight open until its carried roll kills it, it is walled off or the clock
 * runs out), or once `maxTurns` turns have resolved (turn is then maxTurns + 1). Reasons in that
 * order of priority; the all-clear reason keeps the name "noFreePathogens".
 */
export function battleStatus(battle: BattleState): BattleStatus {
  const turnsLeft = Math.max(0, battle.maxTurns - battle.turn + 1);
  if (battle.tissueHealth <= PARAMS.outcome.backupTissueHealth) {
    return { over: true, reason: "backup", turnsLeft: 0 };
  }
  if (
    freePathogens(battle) === 0 &&
    aliveInside(battle) === 0 &&
    battle.arrivals.length === 0
  ) {
    return { over: true, reason: "noFreePathogens", turnsLeft: 0 };
  }
  if (turnsLeft === 0) return { over: true, reason: "maxTurns", turnsLeft };
  return { over: false, reason: null, turnsLeft };
}

/** What carries over: swarm loads (swarm order), granulomas, then hidden tokens. */
export function reservoirs(battle: BattleState): Reservoir[] {
  return [
    ...battle.swarms.flatMap((s) =>
      s.load.map((c) => ({ ...c, source: "swarm" as const, sourceId: s.id })),
    ),
    ...battle.granulomas.flatMap((g) =>
      g.contents.map((c) => ({
        ...c,
        source: "granuloma" as const,
        sourceId: g.id,
      })),
    ),
    ...battle.pathogens
      .filter((p) => p.hidden)
      .map((p) => ({
        kind: p.kind,
        size: p.size,
        source: "hidden" as const,
        sourceId: p.id,
      })),
  ];
}

/**
 * Grades the battle as it stands (normally once battleStatus says it is over).
 * - neededBackup: tissue health at or below `outcome.backupTissueHealth`, or free pathogens left.
 * - contained: otherwise, if any reservoir is left (load, granuloma or hidden token).
 * - cleared: nothing left at all.
 * Energy follows the grade (PARAMS.outcome.energy); a skirmish pays its own, cleared or loose.
 */
export function gradeOutcome(battle: BattleState): BattleOutcome {
  const free = freePathogens(battle);
  const left = reservoirs(battle);
  const backupReasons: ("tissue" | "freePathogens")[] = [];
  if (battle.tissueHealth <= PARAMS.outcome.backupTissueHealth) {
    backupReasons.push("tissue");
  }
  if (free > 0) backupReasons.push("freePathogens");
  const grade: BattleGrade =
    backupReasons.length > 0
      ? "neededBackup"
      : left.length > 0
        ? "contained"
        : "cleared";
  return {
    grade,
    backupReasons,
    freePathogens: free,
    reservoirs: left,
    tissue: {
      health: battle.tissueHealth,
      max: PARAMS.maxTissueHealth,
      lost: PARAMS.maxTissueHealth - battle.tissueHealth,
    },
    energy:
      battle.kind === "skirmish"
        ? PARAMS.campaign.skirmish.energy[
            grade === "cleared" ? "cleared" : "loose"
          ]
        : PARAMS.outcome.energy[grade],
    turnsPlayed: Math.min(battle.turn, battle.maxTurns + 1) - 1,
  };
}
