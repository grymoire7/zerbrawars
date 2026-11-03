import { createBoard, isAdjacent, sameCoord } from "../board";
import type { Loadout } from "../life/loadout";
import { PARAMS } from "../params";
import { rngFromSeed } from "../rng";
import type {
  BattleState,
  Coord,
  MedCharges,
  MedState,
  Pathogen,
} from "../types";
import { validateBattle } from "../validate";
import { initBattle } from "./intents";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Charges for a med level (the first PARAMS.meds.chargeTiers tier it reaches), plus the doctor's. */
export function chargesFor(medLevel: number, doctorVisit = false): MedCharges {
  const level = clamp01(medLevel);
  const tier = PARAMS.meds.chargeTiers.find((t) => level >= t.minLevel);
  return {
    antibacterial: tier?.antibacterial ?? 0,
    antifungal: tier?.antifungal ?? 0,
    strong: doctorVisit ? PARAMS.meds.doctorStrongCharges : 0,
  };
}

export function medStateFor(medLevel: number, doctorVisit = false): MedState {
  const level = clamp01(medLevel);
  return { level, aura: level, charges: chargesFor(level, doctorVisit) };
}

/**
 * Builds the opening BattleState, first telegraph included. Swarms start on
 * PARAMS.setup.swarmStarts (always all of them: neutrophil count is not a lever). Pathogen ids run
 * p1.. over exposures, then reservoirs. Exposures and arrivals grow by `load` (the missed doses, carried on `missedDoses`); the first `maxReservoirs`
 * reservoirs become tokens, hidden unless the doctor visit reveals them. Tiles left unset take
 * the first free tile of their list, skipping tiles next to a swarm; a token placed next to a
 * swarm anyway starts visible, so no swarm ever starts a turn next to a hidden token (applyMoves
 * relies on it). Throws if a placement fails or the result is not a valid battle.
 */
export function battleFromLoadout(loadout: Loadout): BattleState {
  const swarms = PARAMS.setup.swarmStarts
    .slice(0, PARAMS.swarmCount)
    .map((at, i) => ({ id: `s${i + 1}`, at, load: [], busyTurns: 0 }));
  const taken: Coord[] = swarms.map((s) => s.at);
  const nearSwarm = (c: Coord) => swarms.some((s) => isAdjacent(s.at, c));
  const place = (at: Coord | undefined, list: readonly Coord[]): Coord => {
    const c =
      at ??
      list.find((t) => !taken.some((u) => sameCoord(u, t)) && !nearSwarm(t));
    if (!c) throw new Error("no free tile left for a pathogen");
    taken.push(c);
    return c;
  };

  const bonus = Math.max(0, loadout.load);
  const grown = (size: number) =>
    Math.min(PARAMS.maxPathogenSize, size + bonus);
  const pathogens: Pathogen[] = [];
  const add = (p: Omit<Pathogen, "id">) =>
    pathogens.push({ id: `p${pathogens.length + 1}`, ...p });
  for (const e of loadout.exposures) {
    add({
      kind: e.kind,
      size: grown(e.size),
      at: place(e.at, PARAMS.setup.doors),
      hidden: false,
    });
  }
  for (const r of loadout.reservoirs.slice(0, PARAMS.setup.maxReservoirs)) {
    const at = place(r.at, PARAMS.setup.reservoirTiles);
    add({
      kind: r.kind,
      size: Math.min(PARAMS.maxPathogenSize, r.size),
      at,
      hidden: r.hidden && !loadout.doctorVisit && !nearSwarm(at),
    });
  }

  const kind = loadout.kind ?? "full";
  const battle: BattleState = {
    scenario: loadout.scenario,
    kind,
    turn: 1,
    maxTurns:
      kind === "skirmish" ? PARAMS.campaign.skirmish.maxTurns : PARAMS.maxTurns,
    board: createBoard(PARAMS.boardWidth, PARAMS.boardHeight),
    swarms,
    pathogens,
    granulomas: [],
    arrivals: (loadout.arrivals ?? [])
      .map((a) => ({ ...a, size: grown(a.size) }))
      .sort((a, b) => a.turn - b.turn),
    ...(bonus > 0 ? { missedDoses: bonus } : {}),
    intents: [],
    meds: medStateFor(loadout.medLevel, loadout.doctorVisit),
    tissueHealth: PARAMS.maxTissueHealth,
    residualKillChance: loadout.residualKillChance ?? PARAMS.residualKillChance,
    rng: {
      intents: rngFromSeed(loadout.seed),
      resolution: rngFromSeed(loadout.seed ^ 0x9e3779b9),
    },
    nextId: pathogens.length + 1,
  };
  const problems = validateBattle(battle);
  if (problems.length > 0) {
    throw new Error(`invalid loadout: ${problems.join("; ")}`);
  }
  return initBattle(battle);
}
