import { inBounds, tileId } from "./board";
import { isPathogenKindId } from "./pathogens";
import { PARAMS } from "./params";
import type { BattleState, Coord } from "./types";

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

  for (const s of battle.swarms) place(s.id, s.at);
  for (const g of battle.granulomas) place(g.id, g.at);
  for (const p of battle.pathogens) {
    place(p.id, p.at);
    if (!isPathogenKindId(p.kind))
      problems.push(`${p.id} has unknown kind ${p.kind}`);
    if (
      !Number.isInteger(p.size) ||
      p.size < 1 ||
      p.size > PARAMS.maxPathogenSize
    ) {
      problems.push(`${p.id} has invalid size ${p.size}`);
    }
  }
  for (const i of battle.intents) {
    if (!battle.pathogens.some((p) => p.id === i.pathogenId)) {
      problems.push(`intent for missing pathogen ${i.pathogenId}`);
    }
  }
  return problems;
}
