import { battleStatus } from "./battle/outcome";
import { inBounds, tileId } from "./board";
import type { Campaign } from "./campaign";
import { medLevelOf } from "./life/meds";
import type { LifeState } from "./life/types";
import { isPathogenKindId, pathogenKind, wallOf } from "./pathogens";
import { PARAMS } from "./params";
import type { BattleState, Contained, Coord } from "./types";

/**
 * Structural checks on a BattleState (for fixtures, setup and anything loaded from JSON).
 * Returns human-readable problems; an empty list means valid. One occupant per tile, except that
 * a swarm may stand on the granuloma it walled off until it moves away.
 */
export function validateBattle(battle: BattleState): string[] {
  const problems: string[] = [];
  const { board } = battle;
  if (board.tiles.length !== board.width * board.height) {
    problems.push(
      `board has ${board.tiles.length} tiles, expected ${board.width * board.height}`,
    );
  }

  board.tiles.forEach((t, id) => {
    const v = t.inflammation;
    if (!Number.isInteger(v) || v < 0 || v > PARAMS.maxInflammation)
      problems.push(`tile ${id} has invalid inflammation ${v}`);
  });
  const health = battle.tissueHealth;
  if (
    !Number.isInteger(health) ||
    health < 0 ||
    health > PARAMS.maxTissueHealth
  )
    problems.push(`invalid tissue health ${health}`);

  type Kind = "swarm" | "granuloma" | "pathogen";
  const ids = new Set<string>();
  const occupied = new Map<number, { id: string; kind: Kind }[]>();
  const place = (id: string, at: Coord, kind: Kind) => {
    if (ids.has(id)) problems.push(`duplicate id ${id}`);
    ids.add(id);
    if (!inBounds(board, at)) {
      problems.push(`${id} out of bounds at ${at.x},${at.y}`);
      return;
    }
    const tile = tileId(board, at);
    const here = occupied.get(tile) ?? [];
    const shared =
      here.length === 1 &&
      [here[0].kind, kind].sort().join() === "granuloma,swarm";
    if (here.length > 0 && !shared)
      problems.push(`${id} overlaps ${here[0].id} at ${at.x},${at.y}`);
    occupied.set(tile, [...here, { id, kind }]);
  };

  const checkKindAndSize = (
    id: string,
    p: { readonly kind: string; readonly size: number },
  ) => {
    if (!isPathogenKindId(p.kind))
      problems.push(`${id} has unknown kind ${p.kind}`);
    if (
      !Number.isInteger(p.size) ||
      p.size < 1 ||
      p.size > PARAMS.maxPathogenSize
    ) {
      problems.push(`${id} has invalid size ${p.size}`);
    }
  };
  // Only sealed pathogens are ever held; a leaky one dies on engulf.
  const checkContained = (id: string, c: Contained) => {
    checkKindAndSize(`${id} content`, c);
    if (isPathogenKindId(c.kind) && wallOf(c) !== "sealed")
      problems.push(`${id} holds leaky ${c.kind}`);
  };

  for (const s of battle.swarms) {
    place(s.id, s.at, "swarm");
    if (s.load.length > PARAMS.loadCap)
      problems.push(
        `${s.id} load ${s.load.length} is over cap ${PARAMS.loadCap}`,
      );
    for (const c of s.load) checkContained(s.id, c);
    if (!Number.isInteger(s.busyTurns) || s.busyTurns < 0)
      problems.push(`${s.id} has invalid busyTurns ${s.busyTurns}`);
  }
  for (const g of battle.granulomas) {
    place(g.id, g.at, "granuloma");
    if (g.contents.length === 0) problems.push(`${g.id} is empty`);
    for (const c of g.contents) checkContained(g.id, c);
  }
  for (const p of battle.pathogens) {
    place(p.id, p.at, "pathogen");
    checkKindAndSize(p.id, p);
  }
  if (battle.kind !== "full" && battle.kind !== "skirmish")
    problems.push(`unknown battle kind ${String(battle.kind)}`);
  const turns =
    battle.kind === "skirmish"
      ? PARAMS.campaign.skirmish.maxTurns
      : PARAMS.maxTurns;
  if (battle.maxTurns !== turns)
    problems.push(`a ${battle.kind} battle with ${battle.maxTurns} turns`);
  const doorsDue = new Set<string>();
  for (const a of battle.arrivals) {
    const at = `arrival of ${a.kind} at ${a.door.x},${a.door.y}`;
    checkKindAndSize(at, a);
    if (!Number.isInteger(a.turn) || a.turn < battle.turn)
      problems.push(`${at} has invalid turn ${a.turn}`);
    if (!inBounds(board, a.door)) problems.push(`${at} is out of bounds`);
    else {
      const key = `${a.turn}:${tileId(board, a.door)}`;
      if (doorsDue.has(key))
        problems.push(`two arrivals at ${at} on turn ${a.turn}`);
      doorsDue.add(key);
    }
  }
  const chance = battle.residualKillChance;
  if (!(chance >= 0 && chance <= 1))
    problems.push(`residualKillChance ${chance} is outside 0..1`);
  const intended = new Set<string>();
  const targets = new Map<number, string>();
  for (const i of battle.intents) {
    const p = battle.pathogens.find((q) => q.id === i.pathogenId);
    if (!p) {
      problems.push(`intent for missing pathogen ${i.pathogenId}`);
      continue;
    }
    if (intended.has(p.id)) problems.push(`${p.id} has more than one intent`);
    intended.add(p.id);
    if (p.hidden) problems.push(`hidden ${p.id} has an intent`);
    if (i.type === "grow" || i.type === "stall") continue;
    if (
      i.type === "spore" &&
      isPathogenKindId(p.kind) &&
      !pathogenKind(p.kind).canSpore
    ) {
      problems.push(`${p.id} cannot spore`);
    }
    if (!inBounds(board, i.to)) {
      problems.push(`${p.id} targets out of bounds ${i.to.x},${i.to.y}`);
      continue;
    }
    const tile = tileId(board, i.to);
    const other = targets.get(tile);
    if (other !== undefined)
      problems.push(`${p.id} and ${other} target ${i.to.x},${i.to.y}`);
    else targets.set(tile, p.id);
  }
  return problems;
}

/** Structural checks on a LifeState; an empty list means valid. */
export function validateLife(life: LifeState): string[] {
  const problems: string[] = [];
  const L = PARAMS.life;
  if (!Number.isInteger(life.day) || life.day < 0 || life.day > L.days)
    problems.push(`invalid day ${life.day}`);
  if (
    life.plan.length !== L.days ||
    life.plan.some((row) => row.length !== L.slotsPerDay)
  )
    problems.push("plan has the wrong shape");
  if (
    !Number.isInteger(life.energy) ||
    life.energy < 0 ||
    life.energy > L.maxEnergy
  )
    problems.push(`invalid energy ${life.energy}`);
  if (life.medLevel !== medLevelOf(life.doses))
    problems.push(`med level ${life.medLevel} does not match the doses`);
  if (life.reservoirs.length > PARAMS.campaign.carry.maxReservoirs)
    problems.push(`${life.reservoirs.length} reservoirs is over the cap`);
  life.reservoirs.forEach((r, i) => {
    if (!isPathogenKindId(r.kind))
      problems.push(`reservoir ${i} has unknown kind`);
    else if (wallOf(r) !== "sealed") problems.push(`reservoir ${i} is leaky`);
    if (
      !Number.isInteger(r.size) ||
      r.size < 1 ||
      r.size > PARAMS.maxPathogenSize
    )
      problems.push(`reservoir ${i} has invalid size ${r.size}`);
  });
  if (life.hand.includes("doctor") !== life.symptoms.length > 0)
    problems.push(
      "the doctor is in hand without a symptom, or missing with one",
    );
  const a = life.aftermath;
  if (
    a &&
    ((a.kind !== "wornOut" && a.kind !== "flareUp") ||
      a.energy !== PARAMS.campaign.skirmish.aftermathEnergy)
  )
    problems.push("invalid skirmish aftermath");
  if ((life.doctor !== null) !== life.flags.doctorVisit)
    problems.push("doctor visit and flag disagree");
  return problems;
}

/** Mode and structure checks on a Campaign, its week and its battle. */
export function validateCampaign(c: Campaign): string[] {
  const problems = validateLife(c.life).map((p) => `life: ${p}`);
  if (!Number.isInteger(c.cycle) || c.cycle < 1 || c.cycle > c.cycles)
    problems.push(`invalid cycle ${c.cycle} of ${c.cycles}`);
  const finished = c.mode === "done" ? c.cycle : c.cycle - 1;
  if (c.history.length !== finished)
    problems.push(`${c.history.length} weeks recorded, expected ${finished}`);
  if (c.battle)
    problems.push(...validateBattle(c.battle).map((p) => `battle: ${p}`));
  if ((c.battle?.kind ?? null) !== c.battleKind)
    problems.push("battleKind and battle disagree");
  if (c.result?.kind === "battle" && c.result.battleKind !== c.battleKind)
    problems.push("result and battleKind disagree");
  if (c.battle?.kind === "skirmish" && c.loadout?.reservoirs.length)
    problems.push("a skirmish with reservoirs on its board");
  switch (c.mode) {
    case "life":
      if (c.battle || c.loadout || c.result)
        problems.push("life mode keeps a battle or result");
      break;
    case "battle":
      if (!c.battle || !c.loadout)
        problems.push("battle mode without a battle");
      else if (battleStatus(c.battle).over)
        problems.push("battle mode with a finished battle");
      if (c.result) problems.push("battle mode with a result");
      break;
    case "outcome":
    case "done":
      if (!c.result) problems.push(`${c.mode} mode without a result`);
      else if ((c.result.kind === "battle") !== (c.battle !== null))
        problems.push("result and battle disagree");
      if (c.mode === "done" && c.cycle !== c.cycles)
        problems.push("done before the last week");
      break;
  }
  return problems;
}
