import {
  allCoords,
  compareCoords,
  distance,
  inBounds,
  neighbors,
  sameCoord,
  tileId,
} from "../board";
import { PARAMS } from "../params";
import { pathogenKind } from "../pathogens";
import { rngInt, rngNext, type RngState } from "../rng";
import type {
  BattleState,
  Coord,
  Intent,
  Pathogen,
  PathogenId,
  SwarmId,
  TileId,
} from "../types";

/**
 * Tiles a spread or spore may target right now: in bounds and holding no pathogen (hidden ones
 * included) or granuloma. Swarm tiles stay legal; a swarm there blocks the action at resolve.
 */
export function landingBlockers(battle: BattleState): Set<TileId> {
  const { board } = battle;
  return new Set([
    ...battle.pathogens.map((p) => tileId(board, p.at)),
    ...battle.granulomas.map((g) => tileId(board, g.at)),
  ]);
}

/** Candidate targets, row-major (spread: N, E, S, W) so a rolled index always means the same tile. */
function targetsFor(
  battle: BattleState,
  p: Pathogen,
  taken: ReadonlySet<TileId>,
): Coord[] {
  const { board } = battle;
  const free = (c: Coord) => inBounds(board, c) && !taken.has(tileId(board, c));
  if (!pathogenKind(p.kind).canSpore)
    return neighbors(board, p.at).filter(free);
  const { sporeMinDistance, sporeMaxDistance } = PARAMS.intents[p.kind];
  return allCoords(board)
    .filter((c) => {
      const d = distance(p.at, c);
      return d >= sporeMinDistance && d <= sporeMaxDistance && free(c);
    })
    .sort(compareCoords);
}

function rollIntent(
  battle: BattleState,
  p: Pathogen,
  taken: ReadonlySet<TileId>,
  rng: RngState,
): { intent: Intent | null; rng: RngState } {
  const b = PARAMS.intents[p.kind];
  const canGrow = p.size < PARAMS.maxPathogenSize;
  const targets =
    p.size >= b.actMinSize && p.size - b.actCost >= 1
      ? targetsFor(battle, p, taken)
      : [];
  let act = targets.length > 0;
  if (act && canGrow) {
    const roll = rngNext(rng);
    rng = roll.rng;
    act = roll.value < b.actChance;
  }
  if (act) {
    const pick = rngInt(rng, targets.length);
    return {
      intent: {
        type: pathogenKind(p.kind).canSpore ? "spore" : "spread",
        pathogenId: p.id,
        to: targets[pick.value],
        size: b.childSize,
        cost: b.actCost,
      },
      rng: pick.rng,
    };
  }
  if (!canGrow) return { intent: null, rng };
  return {
    intent: {
      type: "grow",
      pathogenId: p.id,
      amount: Math.min(b.growAmount, PARAMS.maxPathogenSize - p.size),
    },
    rng,
  };
}

/**
 * Rolls the telegraph for the coming resolve from `rng.intents` only: at most one intent per
 * visible pathogen, in pathogen (id) order. Each new target is taken, so no two intents share a
 * tile. A pathogen at max size with nowhere to go gets no intent.
 */
export function generateIntents(battle: BattleState): BattleState {
  const taken = landingBlockers(battle);
  const intents: Intent[] = [];
  let rng = battle.rng.intents;
  for (const p of battle.pathogens) {
    if (p.hidden) continue;
    const r = rollIntent(battle, p, taken, rng);
    rng = r.rng;
    if (!r.intent) continue;
    intents.push(r.intent);
    if (r.intent.type !== "grow") taken.add(tileId(battle.board, r.intent.to));
  }
  return { ...battle, intents, rng: { ...battle.rng, intents: rng } };
}

/** Fills the first telegraph of a freshly set-up battle. */
export function initBattle(battle: BattleState): BattleState {
  return generateIntents(battle);
}

/** What the telegraph draws for one pathogen. */
export interface TelegraphMark {
  readonly pathogenId: PathogenId;
  readonly type: Intent["type"];
  readonly from: Coord;
  /** Target tile for spread/spore, null for grow. */
  readonly to: Coord | null;
  /** The pathogen's size after the intent lands. */
  readonly sizeAfter: number;
  /** Size of the new pathogen for spread/spore, 0 for grow. */
  readonly childSize: number;
  /** A swarm now standing on the target, which would block it. */
  readonly blockedBy: SwarmId | null;
}

export function telegraph(battle: BattleState): TelegraphMark[] {
  return battle.intents.flatMap((i): TelegraphMark[] => {
    const p = battle.pathogens.find((q) => q.id === i.pathogenId);
    if (!p) return [];
    if (i.type === "grow") {
      return [
        {
          pathogenId: p.id,
          type: i.type,
          from: p.at,
          to: null,
          sizeAfter: p.size + i.amount,
          childSize: 0,
          blockedBy: null,
        },
      ];
    }
    const swarm = battle.swarms.find((s) => sameCoord(s.at, i.to));
    return [
      {
        pathogenId: p.id,
        type: i.type,
        from: p.at,
        to: i.to,
        sizeAfter: swarm ? p.size : p.size - i.cost,
        childSize: i.size,
        blockedBy: swarm?.id ?? null,
      },
    ];
  });
}
