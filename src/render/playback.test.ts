import { describe, expect, it } from "vitest";
import { battleStatus } from "../sim/battle/outcome";
import { resolveTurn } from "../sim/battle/resolve";
import { loadScenario } from "../sim/scenarios";
import type { BattleState, Order, SimEvent, SupportOrder } from "../sim/types";
import {
  beatProgress,
  buildTimeline,
  createPlayback,
  TIMING,
  type Phase,
} from "./playback";

const load = (seed = 1) => loadScenario("first-board", seed) as BattleState;

// s1 walks up and engulfs the leaky p1; s3 walks toward the sealed p2.
const ORDERS: Order[] = [
  { type: "engulf", swarmId: "s1", pathogenId: "p1", from: { x: 1, y: 3 } },
  { type: "move", swarmId: "s3", to: { x: 5, y: 4 } },
];

const PHASE_ORDER: Phase[] = ["move", "engulf", "pathogen", "tick"];

function spam(before: BattleState): SimEvent[] {
  const events: SimEvent[] = [];
  for (const s of before.swarms) {
    events.push({
      type: "SwarmMoved",
      swarmId: s.id,
      path: [s.at, { x: s.at.x, y: s.at.y - 1 }, { x: s.at.x, y: s.at.y - 2 }],
    });
  }
  for (let i = 0; i < 12; i++) {
    events.push({
      type: "Spored",
      pathogenId: "p2",
      newPathogenId: `p${10 + i}`,
      from: { x: 5, y: 2 },
      to: { x: i % 7, y: 0 },
      size: 1,
      parentSize: 1,
    });
  }
  events.push({ type: "TissueDamaged", amount: 2, tissueHealth: 18 });
  return events;
}

describe("buildTimeline", () => {
  it("plays moves, then engulfs, then pathogens, then the tick", () => {
    const before = load();
    const { events } = resolveTurn(before, ORDERS);
    const t = buildTimeline(before, [
      ...events,
      { type: "TissueDamaged", amount: 1, tissueHealth: 19 },
    ]);
    const phases = t.beats.map((b) => b.phase);
    const ranks = phases.map((p) => PHASE_ORDER.indexOf(p));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(phases).toContain("move");
    expect(phases).toContain("engulf");
    expect(phases).toContain("tick");
    for (let i = 1; i < t.phases.length; i++) {
      expect(t.phases[i]!.start).toBeGreaterThanOrEqual(t.phases[i - 1]!.end);
    }
  });

  it("starts moves together and staggers pathogens in telegraph order", () => {
    const before = load();
    const t = buildTimeline(before, spam(before));
    const moves = t.beats.filter((b) => b.kind === "move");
    expect(new Set(moves.map((b) => b.start)).size).toBe(1);
    const spores = t.beats.filter((b) => b.kind === "spore");
    for (let i = 1; i < spores.length; i++) {
      expect(spores[i]!.start).toBeGreaterThan(spores[i - 1]!.start);
      expect(spores[i]!.events[0]).toBeGreaterThan(spores[i - 1]!.events[0]!);
    }
  });

  it("folds an engulf and its outcome events into one beat", () => {
    const before = load();
    const events: SimEvent[] = [
      { type: "Engulfed", swarmId: "s3", pathogenId: "p2", wall: "sealed" },
      { type: "ResidualKill", swarmId: "s3", chance: 0.1, success: false },
      {
        type: "Loaded",
        swarmId: "s3",
        load: [{ kind: "aspergillus", size: 2 }],
      },
    ];
    const t = buildTimeline(before, events);
    expect(t.beats).toHaveLength(1);
    const b = t.beats[0]!;
    expect(b.kind === "engulf" && b.outcome).toBe("load");
    expect(b.kind === "engulf" && b.chance).toBe(0.1);
    expect(b.kind === "engulf" && b.load).toBe(1);
    expect(b.events).toEqual([0, 1, 2]);
  });

  it("clamps a busy turn to the maximum and keeps every beat inside it", () => {
    const before = load();
    const t = buildTimeline(before, spam(before));
    expect(t.compression).toBeLessThan(1);
    expect(t.duration).toBeCloseTo(TIMING.maxDuration, 9);
    for (const b of t.beats) {
      expect(b.start + b.duration).toBeLessThanOrEqual(t.duration + 1e-9);
      expect(b.reveal).toBeGreaterThanOrEqual(b.start);
    }
  });

  it("keeps a quiet turn short instead of padding it", () => {
    const before = load();
    const t = buildTimeline(before, [
      { type: "Grew", pathogenId: "p1", size: 3 },
    ]);
    expect(t.compression).toBe(1);
    expect(t.duration).toBeLessThan(1.5);
  });

  it("covers every event of real turns within the clamp", () => {
    for (let seed = 1; seed <= 200; seed++) {
      let before = load(seed);
      for (let turn = 0; turn < 6; turn++) {
        if (battleStatus(before).over) break;
        const orders = turn === 0 ? ORDERS : [];
        const r = resolveTurn(before, orders);
        const t = buildTimeline(before, r.events);
        expect(t.duration).toBeLessThanOrEqual(TIMING.maxDuration + 1e-9);
        const covered = t.beats.flatMap((b) => b.events).sort((a, b) => a - b);
        expect(covered).toEqual(r.events.map((_, i) => i));
        before = r.state;
      }
    }
  });

  it("reports beat progress from 0 to 1", () => {
    const before = load();
    const t = buildTimeline(before, spam(before));
    const b = t.beats[t.beats.length - 1]!;
    expect(beatProgress(b, b.start - 1)).toBe(0);
    expect(beatProgress(b, b.start + b.duration / 2)).toBeCloseTo(0.5);
    expect(beatProgress(b, t.duration + 1)).toBe(1);
  });
});

describe("buildTimeline: wall-off and carried loads", () => {
  const loaded = (): BattleState => {
    const b = load();
    return {
      ...b,
      swarms: b.swarms.map((s) =>
        s.id === "s3"
          ? {
              ...s,
              load: [
                { kind: "aspergillus", size: 2 },
                { kind: "aspergillus", size: 1 },
              ],
            }
          : s,
      ),
    };
  };

  it("gives Walled a beat that names the granuloma and clears the swarm's load", () => {
    const before = loaded();
    const events: SimEvent[] = [
      { type: "Walled", swarmId: "s3", granulomaId: "g5", at: { x: 5, y: 6 } },
      { type: "InflammationChanged", at: { x: 5, y: 6 }, inflammation: 1 },
    ];
    const t = buildTimeline(before, events);
    const b = t.beats.find((x) => x.kind === "walled");
    expect(b?.kind === "walled" && b.granulomaId).toBe("g5");
    expect(b?.phase).toBe("engulf");
    expect(t.beats.find((x) => x.kind === "inflame")?.phase).toBe("tick");
    expect(t.beats.flatMap((x) => x.events).sort()).toEqual([0, 1]);
  });

  it("gives carried kill rolls their own beat, folding the Loaded that follows", () => {
    const before = loaded();
    const events: SimEvent[] = [
      { type: "ResidualKill", swarmId: "s3", chance: 0.1, success: false },
      { type: "ResidualKill", swarmId: "s3", chance: 0.1, success: true },
      {
        type: "Loaded",
        swarmId: "s3",
        load: [{ kind: "aspergillus", size: 2 }],
      },
    ];
    const t = buildTimeline(before, events);
    expect(t.beats).toHaveLength(1);
    const b = t.beats[0]!;
    expect(b.kind).toBe("carried");
    if (b.kind !== "carried") return;
    expect(b.rolls).toBe(2);
    expect(b.success).toBe(true);
    expect(b.load).toBe(1);
    expect(b.at).toEqual({ x: 5, y: 6 });
    expect(b.events).toEqual([0, 1, 2]);
  });

  it("reports a failed carried roll with the load unchanged", () => {
    const before = loaded();
    const t = buildTimeline(before, [
      { type: "ResidualKill", swarmId: "s3", chance: 0.1, success: false },
      { type: "ResidualKill", swarmId: "s3", chance: 0.1, success: false },
    ]);
    const b = t.beats[0]!;
    expect(b.kind === "carried" && b.success).toBe(false);
    expect(b.kind === "carried" && b.load).toBe(2);
  });

  it("keeps an engulf's own roll inside the engulf beat", () => {
    const before = load();
    const t = buildTimeline(before, [
      { type: "Engulfed", swarmId: "s3", pathogenId: "p2", wall: "sealed" },
      { type: "ResidualKill", swarmId: "s3", chance: 0.1, success: true },
      { type: "Killed", pathogenId: "p2", at: { x: 5, y: 2 }, cause: "engulf" },
    ]);
    expect(t.beats.map((b) => b.kind)).toEqual(["engulf"]);
  });

  it("covers every event of real turns that wall off and carry loads", () => {
    for (let seed = 1; seed <= 60; seed++) {
      let before = load(seed);
      const turns: Order[][] = [
        [
          {
            type: "engulf",
            swarmId: "s3",
            pathogenId: "p2",
            from: { x: 5, y: 3 },
          },
        ],
        [],
        [{ type: "wallOff", swarmId: "s3" }],
        [],
      ];
      for (const orders of turns) {
        const valid = orders.filter(
          (o) => o.type !== "wallOff" || before.swarms[2]!.load.length > 0,
        );
        let r;
        try {
          r = resolveTurn(before, valid);
        } catch {
          break;
        }
        const t = buildTimeline(before, r.events);
        const covered = t.beats.flatMap((b) => b.events).sort((a, b) => a - b);
        const loose = r.events
          .map((e, i) => (e.type === "Loaded" ? -1 : i))
          .filter((i) => i >= 0 && !covered.includes(i));
        expect(loose).toEqual([]);
        before = r.state;
        if (r.status.over) break;
      }
    }
  });
});

describe("createPlayback", () => {
  it("shows the pre-turn state while playing and the new state at the end", () => {
    const before = load();
    const r = resolveTurn(before, ORDERS);
    const pb = createPlayback(before, r.events, r.state);
    expect(pb.done).toBe(false);
    expect(pb.displayState()).toBe(before);
    pb.advance(0.05);
    expect(pb.displayState()).toBe(before);
    for (let i = 0; i < 400 && !pb.done; i++) pb.advance(1 / 60);
    expect(pb.done).toBe(true);
    expect(pb.skipped).toBe(false);
    expect(pb.displayState()).toBe(r.state);
    expect(pb.revealed()).toEqual(r.events);
  });

  it("lands on exactly the new state when skipped", () => {
    const before = load();
    const r = resolveTurn(before, ORDERS);
    const pb = createPlayback(before, r.events, r.state);
    pb.advance(0.3);
    pb.skip();
    expect(pb.done).toBe(true);
    expect(pb.skipped).toBe(true);
    expect(pb.time).toBe(pb.timeline.duration);
    expect(pb.displayState()).toBe(r.state);
    expect(pb.revealed()).toEqual(r.events);
    expect(pb.advance(1)).toBe(false);
  });

  it("reveals log lines at their beat, not before", () => {
    const before = load();
    const r = resolveTurn(before, ORDERS);
    const pb = createPlayback(before, r.events, r.state);
    expect(pb.revealed()).toEqual([]);
    const firstReveal = Math.min(...pb.timeline.beats.map((b) => b.reveal));
    pb.advance(firstReveal * 0.5);
    expect(pb.revealed()).toEqual([]);
    let last = 0;
    while (!pb.done) {
      pb.advance(1 / 30);
      const n = pb.revealed().length;
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    }
  });

  it("runs twice as fast at 2x", () => {
    const before = load();
    const r = resolveTurn(before, ORDERS);
    const pb = createPlayback(before, r.events, r.state, 2);
    pb.advance(0.1);
    expect(pb.time).toBeCloseTo(0.2);
  });

  it("is done at once when nothing happened", () => {
    const before = load();
    const pb = createPlayback(before, [], before);
    expect(pb.done).toBe(true);
    expect(pb.timeline.duration).toBe(0);
  });
});

describe("buildTimeline: reveals and doses", () => {
  it("gives Revealed a reveal beat in the engulf phase", () => {
    const before = load();
    const events: SimEvent[] = [
      {
        type: "SwarmMoved",
        swarmId: "s1",
        path: [
          { x: 1, y: 6 },
          { x: 1, y: 5 },
        ],
      },
      {
        type: "Revealed",
        pathogenId: "p5",
        at: { x: 1, y: 4 },
        kind: "strep",
        size: 2,
        swarmId: "s1",
      },
    ];
    const t = buildTimeline(before, events);
    const b = t.beats.find((x) => x.kind === "reveal");
    expect(b?.phase).toBe("engulf");
    expect(b?.kind === "reveal" && b.pathogenId).toBe("p5");
    expect(b?.events).toEqual([1]);
    const move = t.beats.find((x) => x.kind === "move")!;
    expect(b!.start).toBeGreaterThan(move.start);
  });

  it("folds SupportUsed and the Killed after it into one dose beat", () => {
    const before = load();
    const at = before.pathogens[1]!.at;
    const events: SimEvent[] = [
      {
        type: "SupportUsed",
        charge: "antifungal",
        target: "pathogen",
        at,
        pathogenId: "p2",
        swarmId: null,
      },
      { type: "Killed", pathogenId: "p2", at, cause: "charge" },
    ];
    const t = buildTimeline(before, events);
    expect(t.beats).toHaveLength(1);
    const b = t.beats[0]!;
    expect(b.kind).toBe("dose");
    expect(b.kind === "dose" && b.charge).toBe("antifungal");
    expect(b.events).toEqual([0, 1]);
    expect(b.reveal).toBeGreaterThan(b.start);
  });

  it("folds a load clear with the Loaded that follows and tracks the load count", () => {
    const base = load();
    const before: BattleState = {
      ...base,
      swarms: base.swarms.map((s) =>
        s.id === "s3"
          ? {
              ...s,
              load: [
                { kind: "aspergillus", size: 2 },
                { kind: "aspergillus", size: 1 },
              ],
            }
          : s,
      ),
    };
    const events: SimEvent[] = [
      {
        type: "SupportUsed",
        charge: "antifungal",
        target: "load",
        at: before.swarms[2]!.at,
        pathogenId: null,
        swarmId: "s3",
      },
      {
        type: "Loaded",
        swarmId: "s3",
        load: [{ kind: "aspergillus", size: 1 }],
      },
    ];
    const t = buildTimeline(before, events);
    expect(t.beats).toHaveLength(1);
    const b = t.beats[0]!;
    expect(b.kind === "dose" && [b.loadBefore, b.load]).toEqual([2, 1]);
    expect(b.events).toEqual([0, 1]);
  });

  it("covers every event of real turns that use a charge", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const before = load(seed);
      const support: SupportOrder = {
        type: "support",
        charge: "antibacterial",
        target: "pathogen",
        pathogenId: "p1",
      };
      const r = resolveTurn(before, [], support);
      const t = buildTimeline(before, r.events);
      const covered = t.beats.flatMap((b) => b.events).sort((a, b) => a - b);
      expect(covered).toEqual(r.events.map((_, i) => i));
      expect(t.beats.some((b) => b.kind === "dose")).toBe(true);
      expect(t.beats.some((b) => b.kind === "killed")).toBe(false);
    }
  });
});
