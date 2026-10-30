import { coordOf, tileId } from "../board";
import { PARAMS } from "../params";
import type { BattleState, Coord, SimEvent, Tile } from "../types";

const I = PARAMS.inflammation;

export type InflammationCause = "crowd" | "load" | "pathogen" | "granuloma";

export interface TileHeat {
  readonly at: Coord;
  readonly before: number;
  readonly after: number;
  /** What pushed it up this tick (empty when it only decayed). */
  readonly causes: readonly InflammationCause[];
}

/** Inflammation of the tile at `at`. */
export function inflammationAt(battle: BattleState, at: Coord): number {
  return battle.board.tiles[tileId(battle.board, at)]?.inflammation ?? 0;
}

const touching = (a: Coord, b: Coord) =>
  !(a.x === b.x && a.y === b.y) &&
  Math.abs(a.x - b.x) <= 1 &&
  Math.abs(a.y - b.y) <= 1;

/**
 * Every tile whose inflammation the tick would change on `battle` (the state after orders and
 * pathogen intents), row-major. See PARAMS.inflammation for the rules.
 */
export function inflammationChanges(
  battle: BattleState,
  start: BattleState = battle,
): TileHeat[] {
  const { board } = battle;
  const rise = new Map<number, number>();
  const causes = new Map<number, Set<InflammationCause>>();
  const add = (at: Coord, amount: number, cause: InflammationCause) => {
    if (amount <= 0) return;
    const id = tileId(board, at);
    rise.set(id, (rise.get(id) ?? 0) + amount);
    causes.set(id, (causes.get(id) ?? new Set()).add(cause));
  };
  for (const s of battle.swarms) {
    const crowd = battle.swarms.filter((o) => touching(s.at, o.at)).length;
    add(s.at, crowd * I.crowdRise, "crowd");
    if (s.load.length > 0) add(s.at, I.loadRise, "load");
  }
  for (const p of battle.pathogens) {
    if (!p.hidden) add(p.at, I.pathogenRise, "pathogen");
  }
  const old = new Set(start.granulomas.map((g) => g.id));
  for (const g of battle.granulomas) {
    if (!old.has(g.id)) add(g.at, I.granulomaRise, "granuloma");
  }
  const floors = new Set(battle.granulomas.map((g) => tileId(board, g.at)));
  const order: InflammationCause[] = ["crowd", "load", "pathogen", "granuloma"];

  return board.tiles.flatMap((tile, id): TileHeat[] => {
    const before = tile.inflammation;
    const r = rise.get(id) ?? 0;
    let after = r > 0 ? before + r : before - I.decay;
    const tileCauses = causes.get(id) ?? new Set<InflammationCause>();
    if (floors.has(id) && after < I.granulomaInflammation) {
      after = I.granulomaInflammation;
      tileCauses.add("granuloma");
    }
    after = Math.max(0, Math.min(PARAMS.maxInflammation, after));
    if (after === before) return [];
    return [
      {
        at: coordOf(board, id),
        before,
        after,
        causes: after > before ? order.filter((c) => tileCauses.has(c)) : [],
      },
    ];
  });
}

/** Tissue health lost per tick for these tile levels. */
export function tissueDamageFor(tiles: readonly Tile[]): number {
  return tiles.reduce(
    (sum, t) =>
      sum + Math.max(0, t.inflammation - I.damageThreshold) * I.damagePerLevel,
    0,
  );
}

/**
 * The end-of-turn tick: inflammation rises or decays (InflammationChanged per changed tile,
 * row-major), then tissue health drops by the damage of the new levels (one TissueDamaged).
 */
export function applyInflammation(
  battle: BattleState,
  start: BattleState = battle,
): {
  state: BattleState;
  events: SimEvent[];
} {
  const changes = inflammationChanges(battle, start);
  const tiles = [...battle.board.tiles];
  const events: SimEvent[] = changes.map((c) => {
    tiles[tileId(battle.board, c.at)] = { inflammation: c.after };
    return { type: "InflammationChanged", at: c.at, inflammation: c.after };
  });
  const amount = Math.min(battle.tissueHealth, tissueDamageFor(tiles));
  const tissueHealth = battle.tissueHealth - amount;
  if (amount > 0) events.push({ type: "TissueDamaged", amount, tissueHealth });
  return {
    state: { ...battle, board: { ...battle.board, tiles }, tissueHealth },
    events,
  };
}
