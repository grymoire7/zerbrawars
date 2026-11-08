import { describe, expect, it } from "vitest";
import { battleFromLoadout } from "../sim/battle/setup";
import {
  DEFAULT_OPTIONS,
  loadoutFor,
  parseLoadoutParams,
  writeLoadoutParams,
} from "./loadoutOptions";

describe("parseLoadoutParams", () => {
  it("uses the defaults when nothing is given", () => {
    expect(parseLoadoutParams(new URLSearchParams(""))).toEqual(
      DEFAULT_OPTIONS,
    );
  });

  it("reads med, doctor and residual, clamping to 0..1", () => {
    const o = parseLoadoutParams(
      new URLSearchParams("med=0.6&doctor=1&residual=3"),
    );
    expect(o).toEqual({ med: 0.6, doctor: true, residual: 1 });
  });

  it("falls back on junk", () => {
    const o = parseLoadoutParams(new URLSearchParams("med=abc&doctor=no"));
    expect(o).toEqual(DEFAULT_OPTIONS);
  });
});

describe("writeLoadoutParams", () => {
  it("round-trips and leaves defaults out of the URL", () => {
    const url = new URL("http://x/?scenario=duel&seed=4");
    writeLoadoutParams(url, { med: 0.3, doctor: true, residual: 0.5 });
    expect(parseLoadoutParams(url.searchParams)).toEqual({
      med: 0.3,
      doctor: true,
      residual: 0.5,
    });
    writeLoadoutParams(url, DEFAULT_OPTIONS);
    expect(url.search).toBe("?scenario=duel&seed=4");
  });
});

describe("loadoutFor", () => {
  it("builds the battle the levers describe", () => {
    const b = battleFromLoadout(
      loadoutFor("first-board", 1, { med: 0.5, doctor: true, residual: 0.4 }),
    );
    expect(b.meds.level).toBe(0.5);
    expect(b.meds.charges.strong).toBeGreaterThan(0);
    expect(b.residualKillChance).toBe(0.4);
    expect(b.scenario).toBe("first-board");
  });

  it("matches the plain scenario at the defaults", () => {
    const plain = battleFromLoadout(loadoutFor("duel", 7, DEFAULT_OPTIONS));
    expect(plain.meds.level).toBe(1);
    expect(plain.meds.charges.strong).toBe(0);
  });

  it("keeps a residual chance the scenario fixes (tutorial-a) and fills in the rest", () => {
    const o = { ...DEFAULT_OPTIONS, residual: 0.25 };
    expect(battleFromLoadout(loadoutFor("tutorial-a", 54, o))).toMatchObject({
      residualKillChance: 0,
      maxTurns: 3,
    });
    expect(
      battleFromLoadout(loadoutFor("tutorial-b", 54, o)).residualKillChance,
    ).toBe(0.25);
  });
});
