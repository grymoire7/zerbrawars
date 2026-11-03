import { describe, expect, it } from "vitest";
import { distance, isAdjacent, sameCoord } from "../board";
import type { Loadout } from "../life/loadout";
import { PARAMS } from "../params";
import {
  duelLoadout,
  firstBoardLoadout,
  loadScenario,
  SCENARIO_LOADOUTS,
  SCENARIO_NAMES,
} from "../scenarios";
import { validateBattle } from "../validate";
import { resolveTurn } from "./resolve";
import { battleFromLoadout, chargesFor, medStateFor } from "./setup";

const base = (over: Partial<Loadout> = {}): Loadout => ({
  schema: 1,
  scenario: "test",
  seed: 3,
  medLevel: 1,
  exposures: [],
  load: 0,
  reservoirs: [],
  doctorVisit: false,
  energy: 0,
  ...over,
});

describe("chargesFor", () => {
  it("follows the med tiers, with the doctor's strong charge on top", () => {
    const table = [1, 0.8, 0.79, 0.6, 0.4, 0.39, 0.3, 0].map((l) => [
      l,
      chargesFor(l),
    ]);
    expect(table).toEqual([
      [1, { antibacterial: 1, antifungal: 2, strong: 0 }],
      [0.8, { antibacterial: 1, antifungal: 2, strong: 0 }],
      [0.79, { antibacterial: 0, antifungal: 1, strong: 0 }],
      [0.6, { antibacterial: 0, antifungal: 1, strong: 0 }],
      [0.4, { antibacterial: 0, antifungal: 1, strong: 0 }],
      [0.39, { antibacterial: 0, antifungal: 0, strong: 0 }],
      [0.3, { antibacterial: 0, antifungal: 0, strong: 0 }],
      [0, { antibacterial: 0, antifungal: 0, strong: 0 }],
    ]);
    expect(chargesFor(0, true).strong).toBe(PARAMS.meds.doctorStrongCharges);
  });

  it("clamps the level into 0..1 for the aura", () => {
    expect(medStateFor(1.5).aura).toBe(1);
    expect(medStateFor(-1).aura).toBe(0);
    expect(medStateFor(0.6)).toMatchObject({ level: 0.6, aura: 0.6 });
  });
});

describe("battleFromLoadout", () => {
  it("builds every named scenario from its loadout", () => {
    for (const name of SCENARIO_NAMES) {
      expect(battleFromLoadout(SCENARIO_LOADOUTS[name](9))).toEqual(
        loadScenario(name, 9),
      );
    }
  });

  it("keeps first-board as playtested: four pathogens, full meds, ids p1..p4", () => {
    const b = battleFromLoadout(firstBoardLoadout(1));
    expect(b.pathogens.map((p) => [p.id, p.kind, p.size])).toEqual([
      ["p1", "strep", 2],
      ["p2", "aspergillus", 3],
      ["p3", "strep", 3],
      ["p4", "strep", 2],
    ]);
    expect(b.nextId).toBe(5);
    expect(b.meds).toEqual({
      level: 1,
      aura: 1,
      charges: { antibacterial: 1, antifungal: 2, strong: 0 },
    });
    expect(b.swarms.map((s) => s.at)).toEqual(PARAMS.setup.swarmStarts);
    expect(b.intents.length).toBeGreaterThan(0);
  });

  it("takes the enemy composition from the exposures, grown by the load", () => {
    const b = battleFromLoadout(
      base({
        exposures: [
          { kind: "aspergillus", size: 1 },
          { kind: "strep", size: 3 },
          { kind: "strep", size: 1 },
        ],
        load: 2,
      }),
    );
    expect(b.pathogens.map((p) => [p.kind, p.size, p.at, p.hidden])).toEqual([
      ["aspergillus", 3, PARAMS.setup.doors[0], false],
      ["strep", PARAMS.maxPathogenSize, PARAMS.setup.doors[1], false],
      ["strep", 3, PARAMS.setup.doors[2], false],
    ]);
  });

  it("skips taken tiles when placing exposures", () => {
    const b = battleFromLoadout(
      base({
        exposures: [
          { kind: "strep", size: 1, at: PARAMS.setup.doors[1] },
          { kind: "strep", size: 1 },
          { kind: "strep", size: 1 },
        ],
      }),
    );
    expect(b.pathogens.map((p) => p.at)).toEqual([
      PARAMS.setup.doors[1],
      PARAMS.setup.doors[0],
      PARAMS.setup.doors[2],
    ]);
  });

  it("starts carried reservoirs as hidden tokens, capped, away from the swarms", () => {
    const b = battleFromLoadout(
      base({
        exposures: [{ kind: "strep", size: 2 }],
        reservoirs: [
          { kind: "aspergillus", size: 2, hidden: true },
          { kind: "aspergillus", size: 1, hidden: false },
          { kind: "aspergillus", size: 1, hidden: true },
        ],
      }),
    );
    const tokens = b.pathogens.slice(1);
    expect(tokens).toHaveLength(PARAMS.setup.maxReservoirs);
    expect(tokens.map((p) => [p.id, p.hidden, p.at])).toEqual([
      ["p2", true, PARAMS.setup.reservoirTiles[0]],
      ["p3", false, PARAMS.setup.reservoirTiles[1]],
    ]);
    for (const t of tokens)
      expect(b.swarms.some((s) => isAdjacent(s.at, t.at))).toBe(false);
    // Hidden tokens get no telegraph.
    expect(b.intents.map((i) => i.pathogenId)).not.toContain("p2");
    expect(validateBattle(b)).toEqual([]);
  });

  it("starts a token placed next to a swarm visible", () => {
    const b = battleFromLoadout(
      base({
        exposures: [{ kind: "strep", size: 2 }],
        reservoirs: [
          { kind: "aspergillus", size: 1, hidden: true, at: { x: 1, y: 5 } },
        ],
      }),
    );
    expect(b.pathogens[1].hidden).toBe(false);
  });

  it("lets a doctor visit reveal every token and add a strong charge", () => {
    const loadout = base({
      exposures: [{ kind: "strep", size: 2 }],
      reservoirs: [{ kind: "aspergillus", size: 2, hidden: true }],
    });
    const without = battleFromLoadout(loadout);
    const withDoctor = battleFromLoadout({ ...loadout, doctorVisit: true });
    expect(without.pathogens[1].hidden).toBe(true);
    expect(withDoctor.pathogens[1].hidden).toBe(false);
    expect(withDoctor.meds.charges.strong).toBe(1);
    expect(without.meds.charges.strong).toBe(0);
    expect(withDoctor.intents.map((i) => i.pathogenId)).toContain("p2");
  });

  it("sets the aura and charges from the med level", () => {
    const at = (medLevel: number) =>
      battleFromLoadout(firstBoardLoadout(1, medLevel)).meds;
    expect(at(0.3)).toEqual({
      level: 0.3,
      aura: 0.3,
      charges: { antibacterial: 0, antifungal: 0, strong: 0 },
    });
    expect(at(0.6).charges.antifungal).toBe(1);
  });

  it("uses the residual override and the seed", () => {
    const b = battleFromLoadout(base({ residualKillChance: 0.5 }));
    expect(b.residualKillChance).toBe(0.5);
    expect(battleFromLoadout(base()).residualKillChance).toBe(
      PARAMS.residualKillChance,
    );
    expect(battleFromLoadout(duelLoadout(4))).toEqual(
      battleFromLoadout(duelLoadout(4)),
    );
    expect(battleFromLoadout(duelLoadout(4)).rng).not.toEqual(
      battleFromLoadout(duelLoadout(5)).rng,
    );
  });

  it("throws on a loadout that cannot make a valid board", () => {
    expect(() =>
      battleFromLoadout(
        base({ exposures: [{ kind: "strep", size: 1, at: { x: 9, y: 0 } }] }),
      ),
    ).toThrow(/invalid loadout/);
    expect(() =>
      battleFromLoadout(
        base({
          exposures: [
            { kind: "strep", size: 1, at: PARAMS.setup.swarmStarts[0] },
          ],
        }),
      ),
    ).toThrow(/overlaps/);
  });

  it("round-trips a loadout and its battle through JSON", () => {
    const loadout = base({
      exposures: [{ kind: "aspergillus", size: 2 }],
      reservoirs: [{ kind: "aspergillus", size: 1, hidden: true }],
      residualKillChance: 0.2,
    });
    expect(JSON.parse(JSON.stringify(loadout))).toEqual(loadout);
    const battle = battleFromLoadout(loadout);
    const reloaded = JSON.parse(JSON.stringify(battle)) as typeof battle;
    expect(reloaded).toEqual(battle);
    expect(resolveTurn(reloaded)).toEqual(resolveTurn(battle));
  });
});

describe("doors", () => {
  // A swarm moves swarmMoveRange steps and engulfs one tile further, so a germ at least that far
  // plus one from every swarm start cannot be touched on turn 1.
  const REACH = PARAMS.swarmMoveRange + 1;
  const farFromSwarms = (c: { x: number; y: number }) =>
    PARAMS.setup.swarmStarts.every((s) => distance(s, c) > REACH);

  it("keeps every door out of turn-1 reach, so first contact is on turn 2", () => {
    expect(PARAMS.setup.doors.length).toBeGreaterThanOrEqual(6);
    for (const d of PARAMS.setup.doors) expect(farFromSwarms(d)).toBe(true);
    for (const t of PARAMS.campaign.skirmish.tiles)
      expect(PARAMS.setup.doors.some((d) => sameCoord(d, t))).toBe(true);
    for (const card of Object.values(PARAMS.life.cards))
      for (const at of card.at)
        expect(PARAMS.setup.doors.some((d) => sameCoord(d, at))).toBe(true);
  });

  it("puts doors on the far edge: the top two rows, or a side column", () => {
    for (const d of PARAMS.setup.doors)
      expect(d.y <= 1 || d.x === 0 || d.x === PARAMS.boardWidth - 1).toBe(true);
  });

  it("places default exposures on doors, none within reach on turn 1", () => {
    const b = battleFromLoadout(
      base({
        exposures: [
          { kind: "strep", size: 2 },
          { kind: "staph", size: 2 },
          { kind: "aspergillus", size: 2 },
        ],
      }),
    );
    for (const p of b.pathogens) expect(farFromSwarms(p.at)).toBe(true);
    const turn1 = resolveTurn(b, []).state;
    // Nothing was engulfed or killed on turn 1; the germs are still all there.
    expect(turn1.pathogens.length).toBeGreaterThanOrEqual(b.pathogens.length);
  });
});
