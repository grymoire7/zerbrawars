import { describe, expect, it } from "vitest";
import {
  allCoords,
  coordOf,
  createBoard,
  distance,
  inBounds,
  neighbors,
  reachableTiles,
  shortestPath,
  swarmBlockers,
  tileId,
  type Blockers,
} from "./board";
import { loadScenario } from "./scenarios";
import type { BattleState, Coord } from "./types";

const board = createBoard(7, 7);

function blockers(
  board: ReturnType<typeof createBoard>,
  blocked: Coord[],
  noStop: Coord[] = [],
): Blockers {
  return {
    blocked: new Set(blocked.map((c) => tileId(board, c))),
    noStop: new Set(noStop.map((c) => tileId(board, c))),
  };
}

describe("bounds and ids", () => {
  it("accepts corners and rejects outside or fractional coords", () => {
    expect(inBounds(board, { x: 0, y: 0 })).toBe(true);
    expect(inBounds(board, { x: 6, y: 6 })).toBe(true);
    expect(inBounds(board, { x: -1, y: 0 })).toBe(false);
    expect(inBounds(board, { x: 7, y: 3 })).toBe(false);
    expect(inBounds(board, { x: 3, y: 7 })).toBe(false);
    expect(inBounds(board, { x: 1.5, y: 1 })).toBe(false);
  });

  it("round-trips tile ids in row-major order", () => {
    expect(tileId(board, { x: 2, y: 3 })).toBe(23);
    const coords = allCoords(board);
    expect(coords).toHaveLength(49);
    coords.forEach((c, id) => {
      expect(tileId(board, c)).toBe(id);
      expect(coordOf(board, id)).toEqual(c);
    });
  });
});

describe("adjacency", () => {
  it("gives 4 neighbours in N, E, S, W order in the middle", () => {
    expect(neighbors(board, { x: 3, y: 3 })).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 2, y: 3 },
    ]);
  });

  it("clips at corners and edges and never includes diagonals", () => {
    expect(neighbors(board, { x: 0, y: 0 })).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
    expect(neighbors(board, { x: 6, y: 3 })).toHaveLength(3);
    for (const n of neighbors(board, { x: 3, y: 3 })) {
      expect(distance(n, { x: 3, y: 3 })).toBe(1);
    }
  });

  it("measures Manhattan distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 6, y: 6 })).toBe(12);
    expect(distance({ x: 2, y: 5 }, { x: 4, y: 1 })).toBe(6);
  });
});

describe("reachableTiles", () => {
  it("returns a diamond on an open board, excluding the start, row-major", () => {
    const r = reachableTiles(board, { x: 3, y: 3 }, 2);
    expect(r).toHaveLength(12);
    expect(r.some((t) => t.at.x === 3 && t.at.y === 3)).toBe(false);
    expect(r[0]).toEqual({ at: { x: 3, y: 1 }, steps: 2 });
    const sorted = [...r].sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);
    expect(r).toEqual(sorted);
    for (const t of r) expect(t.steps).toBe(distance(t.at, { x: 3, y: 3 }));
  });

  it("returns nothing for zero steps", () => {
    expect(reachableTiles(board, { x: 3, y: 3 }, 0)).toEqual([]);
  });

  it("routes around blocked tiles and counts the detour", () => {
    // A wall across row 2 except x=0.
    const wall = [1, 2, 3, 4, 5, 6].map((x) => ({ x, y: 2 }));
    const r = reachableTiles(board, { x: 3, y: 3 }, 6, blockers(board, wall));
    expect(r.some((t) => t.at.y === 2 && t.at.x > 0)).toBe(false);
    // (3,1) is 2 steps open, but 3+1+1+3 = 8 around the wall: out of range.
    expect(r.find((t) => t.at.x === 3 && t.at.y === 1)).toBeUndefined();
    expect(r.find((t) => t.at.x === 0 && t.at.y === 1)).toEqual({
      at: { x: 0, y: 1 },
      steps: 5,
    });
  });

  it("passes through noStop tiles without ending on them", () => {
    const b = blockers(board, [], [{ x: 3, y: 2 }]);
    const r = reachableTiles(board, { x: 3, y: 3 }, 2, b);
    expect(r.find((t) => t.at.x === 3 && t.at.y === 2)).toBeUndefined();
    expect(r.find((t) => t.at.x === 3 && t.at.y === 1)).toEqual({
      at: { x: 3, y: 1 },
      steps: 2,
    });
  });

  it("is empty when fully boxed in", () => {
    const b = blockers(board, neighbors(board, { x: 3, y: 3 }));
    expect(reachableTiles(board, { x: 3, y: 3 }, 3, b)).toEqual([]);
  });
});

describe("shortestPath", () => {
  it("includes both ends and is deterministic", () => {
    const p = shortestPath(board, { x: 0, y: 0 }, { x: 2, y: 1 });
    expect(p).toHaveLength(4);
    expect(p?.[0]).toEqual({ x: 0, y: 0 });
    expect(p?.at(-1)).toEqual({ x: 2, y: 1 });
    expect(shortestPath(board, { x: 0, y: 0 }, { x: 2, y: 1 })).toEqual(p);
  });

  it("returns null for blocked, noStop or out-of-bounds targets", () => {
    const b = blockers(board, [{ x: 1, y: 0 }], [{ x: 0, y: 1 }]);
    expect(shortestPath(board, { x: 0, y: 0 }, { x: 1, y: 0 }, b)).toBeNull();
    expect(shortestPath(board, { x: 0, y: 0 }, { x: 0, y: 1 }, b)).toBeNull();
    expect(shortestPath(board, { x: 0, y: 0 }, { x: 9, y: 0 })).toBeNull();
  });
});

describe("swarmBlockers", () => {
  it("walls off pathogens and granulomas, lets swarms pass, ignores hidden tokens", () => {
    const base = loadScenario("first-board") as BattleState;
    const battle: BattleState = {
      ...base,
      granulomas: [{ id: "g9", at: { x: 3, y: 4 }, contents: [] }],
      pathogens: [
        ...base.pathogens,
        {
          id: "p9",
          kind: "aspergillus",
          size: 1,
          at: { x: 3, y: 3 },
          hidden: true,
        },
      ],
    };
    const b = swarmBlockers(battle, "s2");
    const id = (c: Coord) => tileId(battle.board, c);
    expect(b.blocked.has(id({ x: 1, y: 2 }))).toBe(true);
    expect(b.blocked.has(id({ x: 5, y: 2 }))).toBe(true);
    expect(b.blocked.has(id({ x: 3, y: 4 }))).toBe(true);
    expect(b.blocked.has(id({ x: 3, y: 3 }))).toBe(false);
    expect([...b.noStop].sort()).toEqual(
      [id({ x: 1, y: 6 }), id({ x: 5, y: 6 })].sort(),
    );
  });
});
