import { describe, expect, it } from "vitest";
import { isAdjacent, reachableTiles, swarmBlockers } from "./board";
import { PARAMS } from "./params";
import { wallOf } from "./pathogens";
import { rngNext } from "./rng";
import { loadScenario, SCENARIO_NAMES } from "./scenarios";
import type { BattleState, GameState } from "./types";
import { validateBattle } from "./validate";

describe.each(SCENARIO_NAMES)("scenario %s", (name) => {
  const battle = loadScenario(name) as BattleState;

  it("is structurally valid: in bounds, no overlaps, known kinds", () => {
    expect(validateBattle(battle)).toEqual([]);
  });

  it("matches the params board and swarm count", () => {
    expect(battle.board.width).toBe(PARAMS.boardWidth);
    expect(battle.board.height).toBe(PARAMS.boardHeight);
    expect(battle.swarms).toHaveLength(PARAMS.swarmCount);
  });

  it("survives a JSON round-trip unchanged", () => {
    const game: GameState = {
      schema: 1,
      mode: "battle",
      rng: { state: 7 },
      battle,
    };
    expect(JSON.parse(JSON.stringify(game))).toEqual(game);
  });

  it("is deterministic per seed and the rng streams differ", () => {
    expect(loadScenario(name, 5)).toEqual(loadScenario(name, 5));
    expect(loadScenario(name, 5)).not.toEqual(loadScenario(name, 6));
    expect(rngNext(battle.rng.intents).value).not.toBe(
      rngNext(battle.rng.resolution).value,
    );
  });
});

describe("first-board", () => {
  const battle = loadScenario("first-board") as BattleState;

  it("has one leaky and one sealed pathogen", () => {
    expect(battle.pathogens.map(wallOf).sort()).toEqual(["leaky", "sealed"]);
  });

  it("puts every pathogen within move-and-engulf range of some swarm on turn 1", () => {
    for (const p of battle.pathogens) {
      const canReach = battle.swarms.some((s) =>
        reachableTiles(
          battle.board,
          s.at,
          PARAMS.swarmMoveRange,
          swarmBlockers(battle, s.id),
        ).some((t) => isAdjacent(t.at, p.at)),
      );
      expect(canReach, p.id).toBe(true);
    }
  });
});

describe("loadScenario", () => {
  it("returns null for an unknown name", () => {
    expect(loadScenario("nope")).toBeNull();
    expect(loadScenario("toString")).toBeNull();
  });
});

describe("validateBattle", () => {
  it("reports overlaps and out-of-bounds entities", () => {
    const base = loadScenario("first-board") as BattleState;
    const bad: BattleState = {
      ...base,
      swarms: [
        ...base.swarms,
        { id: "s4", at: base.pathogens[0].at, load: [], busyTurns: 0 },
        { id: "s5", at: { x: 7, y: 0 }, load: [], busyTurns: 0 },
      ],
    };
    const problems = validateBattle(bad);
    expect(problems.some((p) => p.includes("overlaps"))).toBe(true);
    expect(problems.some((p) => p.includes("out of bounds"))).toBe(true);
  });
});
