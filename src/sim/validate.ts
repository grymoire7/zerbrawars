import { inBounds, tileId } from "./board";
import { isPathogenKindId, pathogenKind, wallOf } from "./pathogens";
import { PARAMS } from "./params";
import type { BattleState, Contained, Coord } from "./types";

/**
 * Structural checks on a BattleState (for fixtures, setup and anything loaded from JSON).
 * Returns human-readable problems; an empty list means valid. One occupant per tile.
 */
export function validateBattle(battle: BattleState): string[] {
  const problems: string[] = [];
  const { board } = battle;
  if (board.tiles.length !== board.width * board.height) {
    problems.push(
      `board has ${board.tiles.length} tiles, expected ${board.width * board.height}`,
    );
  }

  const ids = new Set<string>();
  const occupied = new Map<number, string>();
  const place = (id: string, at: Coord) => {
    if (ids.has(id)) problems.push(`duplicate id ${id}`);
    ids.add(id);
    if (!inBounds(board, at)) {
      problems.push(`${id} out of bounds at ${at.x},${at.y}`);
      return;
    }
    const tile = tileId(board, at);
    const other = occupied.get(tile);
    if (other !== undefined)
      problems.push(`${id} overlaps ${other} at ${at.x},${at.y}`);
    else occupied.set(tile, id);
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
    place(s.id, s.at);
    if (s.load.length > PARAMS.loadCap)
      problems.push(
        `${s.id} load ${s.load.length} is over cap ${PARAMS.loadCap}`,
      );
    for (const c of s.load) checkContained(s.id, c);
    if (!Number.isInteger(s.busyTurns) || s.busyTurns < 0)
      problems.push(`${s.id} has invalid busyTurns ${s.busyTurns}`);
  }
  for (const g of battle.granulomas) {
    place(g.id, g.at);
    for (const c of g.contents) checkContained(g.id, c);
  }
  for (const p of battle.pathogens) {
    place(p.id, p.at);
    checkKindAndSize(p.id, p);
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
    if (i.type === "grow") continue;
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
