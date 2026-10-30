import type { BattleState, Board, Coord, SwarmId, TileId } from "./types";

export function createBoard(width: number, height: number): Board {
  return {
    width,
    height,
    tiles: Array.from({ length: width * height }, () => ({ inflammation: 0 })),
  };
}

export function inBounds(board: Board, c: Coord): boolean {
  return (
    Number.isInteger(c.x) &&
    Number.isInteger(c.y) &&
    c.x >= 0 &&
    c.y >= 0 &&
    c.x < board.width &&
    c.y < board.height
  );
}

export function tileId(board: Board, c: Coord): TileId {
  return c.y * board.width + c.x;
}

export function coordOf(board: Board, id: TileId): Coord {
  return { x: id % board.width, y: Math.floor(id / board.width) };
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Row-major order (y, then x): the canonical order for any list of tiles. */
export function compareCoords(a: Coord, b: Coord): number {
  return a.y - b.y || a.x - b.x;
}

/** Every tile coordinate in row-major order. */
export function allCoords(board: Board): Coord[] {
  return board.tiles.map((_, id) => coordOf(board, id));
}

// 4-neighbour only, no diagonals. On an angled camera diagonal arrows are hard to read, and
// "stand in the way" only works if a pathogen has few enough exits that swarms can cover them.
// Fixed order N, E, S, W keeps paths and results deterministic.
const STEPS: readonly Coord[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function neighbors(board: Board, c: Coord): Coord[] {
  return STEPS.map((d) => ({ x: c.x + d.x, y: c.y + d.y })).filter((n) =>
    inBounds(board, n),
  );
}

export function isAdjacent(a: Coord, b: Coord): boolean {
  return distance(a, b) === 1;
}

/** Manhattan distance, which equals move steps on an open board. */
export function distance(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export interface Blockers {
  /** Cannot be entered or passed through. */
  readonly blocked: ReadonlySet<TileId>;
  /** Can be passed through but not ended on. */
  readonly noStop: ReadonlySet<TileId>;
}

export const NO_BLOCKERS: Blockers = { blocked: new Set(), noStop: new Set() };

export interface Reach {
  readonly at: Coord;
  readonly steps: number;
}

/** BFS from `from`; returns parent links by TileId (-1 for the start). */
function search(
  board: Board,
  from: Coord,
  maxSteps: number,
  blockers: Blockers,
): { steps: Map<TileId, number>; parent: Map<TileId, TileId> } {
  const start = tileId(board, from);
  const steps = new Map<TileId, number>([[start, 0]]);
  const parent = new Map<TileId, TileId>([[start, -1]]);
  let frontier = [from];
  for (let s = 1; s <= maxSteps && frontier.length > 0; s++) {
    const next: Coord[] = [];
    for (const c of frontier) {
      for (const n of neighbors(board, c)) {
        const id = tileId(board, n);
        if (steps.has(id) || blockers.blocked.has(id)) continue;
        steps.set(id, s);
        parent.set(id, tileId(board, c));
        next.push(n);
      }
    }
    frontier = next;
  }
  return { steps, parent };
}

/**
 * Tiles a unit at `from` can end on within `maxSteps`, excluding `from` itself.
 * Sorted row-major so previews and tests are stable.
 */
export function reachableTiles(
  board: Board,
  from: Coord,
  maxSteps: number,
  blockers: Blockers = NO_BLOCKERS,
): Reach[] {
  const { steps } = search(board, from, maxSteps, blockers);
  const start = tileId(board, from);
  return [...steps]
    .filter(([id]) => id !== start && !blockers.noStop.has(id))
    .map(([id, s]) => ({ at: coordOf(board, id), steps: s }))
    .sort((a, b) => compareCoords(a.at, b.at));
}

/**
 * A shortest path from `from` to `to`, both included, or null if `to` cannot be ended on.
 * Ties break by neighbour order (N, E, S, W), so the same board always gives the same path.
 */
export function shortestPath(
  board: Board,
  from: Coord,
  to: Coord,
  blockers: Blockers = NO_BLOCKERS,
  maxSteps = board.width * board.height,
): Coord[] | null {
  if (!inBounds(board, to)) return null;
  const target = tileId(board, to);
  if (sameCoord(from, to)) return [from];
  if (blockers.noStop.has(target)) return null;
  const { parent } = search(board, from, maxSteps, blockers);
  if (!parent.has(target)) return null;
  const path: Coord[] = [];
  for (let id = target; id !== -1; id = parent.get(id) ?? -1) {
    path.push(coordOf(board, id));
  }
  return path.reverse();
}

/**
 * Movement blockers for one swarm. Granulomas and visible pathogens are walls. Other swarms can
 * be passed through but not shared. Hidden pathogens are ignored so movement never leaks them;
 * what happens on contact is a T9 rule.
 */
export function swarmBlockers(battle: BattleState, swarmId: SwarmId): Blockers {
  const { board } = battle;
  const blocked = new Set<TileId>([
    ...battle.granulomas.map((g) => tileId(board, g.at)),
    ...battle.pathogens
      .filter((p) => !p.hidden)
      .map((p) => tileId(board, p.at)),
  ]);
  const noStop = new Set<TileId>(
    battle.swarms
      .filter((s) => s.id !== swarmId)
      .map((s) => tileId(board, s.at)),
  );
  return { blocked, noStop };
}
