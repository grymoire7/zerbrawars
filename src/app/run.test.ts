import { describe, expect, it } from "vitest";
import { advanceDay } from "../sim/life/calendar";
import { parseSessionLog } from "../sim/sessionLog";
import { createRun } from "./run";

describe("createRun", () => {
  it("logs the session start and week start, and exports parseable JSON", () => {
    let t = 0;
    const run = createRun({ seed: 5, now: () => (t += 10) });
    run.life((l) => advanceDay(l));
    run.ui("setting", "probe=true");
    const log = parseSessionLog(run.exportJson());
    const types = log.entries.map((e) => e.type);
    expect(types[0]).toBe("session");
    expect(types).toContain("weekStarted");
    expect(types).toContain("ui");
    const stamps = log.entries.map((e) => e.t);
    expect([...stamps].sort((a, b) => a - b)).toEqual(stamps);
  });

  it("starts with the debug reservoirs and med level", () => {
    const run = createRun({
      seed: 1,
      med: 0.67,
      reservoirs: [{ kind: "staph", size: 2, hidden: true }],
    });
    const life = run.campaign().life;
    expect(life.reservoirs.length).toBe(1);
    expect(life.medLevel).toBeCloseTo(0.67, 1);
  });

  it("logs turns and probes with the campaign's cycle", () => {
    const run = createRun({ seed: 1 });
    run.turn({
      turn: 1,
      orders: [],
      support: null,
      planningMs: 1200,
      playbackMs: 800,
      skipped: false,
      replays: 0,
      speed: 1,
    });
    run.probe(2, "Germs grow or spread");
    const last = run.log().entries.slice(-2);
    expect(last.map((e) => e.type)).toEqual(["turn", "probe"]);
  });
});
