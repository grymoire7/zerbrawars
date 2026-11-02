import { describe, expect, it } from "vitest";
import {
  BEST_KEY,
  bestId,
  listBest,
  loadBest,
  readBest,
  recordRun,
  type BestStorage,
} from "./bestScores";

function fake(initial?: string): BestStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(BEST_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const throwing: BestStorage = {
  getItem() {
    throw new Error("blocked");
  },
  setItem() {
    throw new Error("blocked");
  },
};

const id = bestId({ scoreVersion: 1, arc: "summer", variant: "xl", seed: 1 });
const run = (total: number, choices: number) => ({
  total,
  choices,
  outcome: total - choices,
});

describe("bestId", () => {
  it("joins version, arc, variant and seed", () => {
    expect(id).toBe("1|summer|xl|1");
  });
});

describe("recordRun", () => {
  it("records a first run as the best", () => {
    const s = fake();
    const r = recordRun(id, run(500, 300), s);
    expect(r.stored).toBe(true);
    expect(r.previous).toBeNull();
    expect(r.newBestTotal).toBe(true);
    expect(r.entry).toMatchObject({ total: 500, choices: 300, runs: 1 });
    expect(readBest(id, s)?.total).toBe(500);
  });

  it("keeps a higher total, and reports the previous best", () => {
    const s = fake();
    recordRun(id, run(500, 300), s);
    const r = recordRun(id, run(600, 280), s);
    expect(r.newBestTotal).toBe(true);
    expect(r.newBestChoices).toBe(false);
    expect(r.previous?.total).toBe(500);
    expect(r.entry).toMatchObject({
      total: 600,
      choices: 300,
      outcome: 320,
      runs: 2,
    });
  });

  it("keeps the best when a lower score comes in, but counts the run", () => {
    const s = fake();
    recordRun(id, run(600, 300), s);
    const r = recordRun(id, run(450, 200), s);
    expect(r.newBestTotal).toBe(false);
    expect(r.newBestChoices).toBe(false);
    expect(r.entry).toMatchObject({ total: 600, choices: 300, runs: 2 });
  });

  it("tracks a best Choices from a run that did not set the best total", () => {
    const s = fake();
    recordRun(id, run(600, 300), s);
    const r = recordRun(id, run(550, 340), s);
    expect(r.newBestTotal).toBe(false);
    expect(r.newBestChoices).toBe(true);
    expect(r.entry).toMatchObject({ total: 600, choices: 340 });
  });

  it("does not treat an equal score as a new best", () => {
    const s = fake();
    recordRun(id, run(600, 300), s);
    expect(recordRun(id, run(600, 300), s).newBestTotal).toBe(false);
  });

  it("keeps seeds and variants apart", () => {
    const s = fake();
    const other = bestId({
      scoreVersion: 1,
      arc: "summer",
      variant: "xl",
      seed: 2,
    });
    const ar = bestId({
      scoreVersion: 1,
      arc: "summer",
      variant: "ar",
      seed: 1,
    });
    recordRun(id, run(600, 300), s);
    expect(recordRun(other, run(400, 200), s).newBestTotal).toBe(true);
    expect(recordRun(ar, run(300, 100), s).previous).toBeNull();
    expect(readBest(id, s)?.total).toBe(600);
    expect(readBest(other, s)?.total).toBe(400);
    expect(listBest("xl", s).map((e) => e.id)).toEqual([id, other]);
    expect(listBest("ar", s)).toHaveLength(1);
  });

  it("keeps at most 50 entries, dropping the oldest", () => {
    const s = fake();
    for (let i = 0; i < 55; i++)
      recordRun(`k${i}`, run(100, 50), s, () => new Date(2026, 0, 1, 0, i));
    const all = loadBest(s);
    expect(Object.keys(all)).toHaveLength(50);
    expect(all.k0).toBeUndefined();
    expect(all.k54).toBeDefined();
  });

  it("starts over from corrupted JSON without throwing", () => {
    for (const bad of ["{nope", "null", '{"v":2,"entries":{}}', '"x"', "[]"]) {
      const s = fake(bad);
      expect(loadBest(s)).toEqual({});
      expect(recordRun(id, run(500, 300), s).newBestTotal).toBe(true);
      expect(readBest(id, s)?.total).toBe(500);
    }
  });

  it("drops malformed entries but keeps valid ones", () => {
    const good = { total: 1, choices: 1, outcome: 0, runs: 1, at: "x" };
    const s = fake(
      JSON.stringify({ v: 1, entries: { a: good, b: { total: "9" } } }),
    );
    expect(Object.keys(loadBest(s))).toEqual(["a"]);
  });

  it("does not throw when storage throws, and says nothing was saved", () => {
    expect(loadBest(throwing)).toEqual({});
    expect(readBest(id, throwing)).toBeNull();
    const r = recordRun(id, run(500, 300), throwing);
    expect(r).toMatchObject({
      stored: false,
      entry: null,
      newBestTotal: false,
    });
    expect(listBest("xl", throwing)).toEqual([]);
  });

  it("copes with no storage at all", () => {
    expect(recordRun(id, run(500, 300), null).stored).toBe(false);
    expect(readBest(id, null)).toBeNull();
  });
});
