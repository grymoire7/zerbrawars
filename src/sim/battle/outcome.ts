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
 * Over once no visible pathogen is left, or once `maxTurns` turns have resolved (turn is then
 * maxTurns + 1). No free pathogens wins over the turn limit as the reason.
 */
export function battleStatus(battle: BattleState): BattleStatus {
  const turnsLeft = Math.max(0, battle.maxTurns - battle.turn + 1);
  if (freePathogens(battle) === 0) {
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
    energy: PARAMS.outcome.energy[grade],
    turnsPlayed: Math.min(battle.turn, battle.maxTurns + 1) - 1,
  };
}
