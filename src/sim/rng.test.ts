import { describe, expect, it } from "vitest";
import { mulberry32, rngFromSeed, rngInt, rngNext } from "./rng";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("matches the pure rngNext stream", () => {
    const next = mulberry32(42);
    let rng = rngFromSeed(42);
    for (let i = 0; i < 5; i++) {
      const r = rngNext(rng);
      rng = r.rng;
      expect(next()).toBe(r.value);
    }
  });

  it("keeps rng state JSON-serializable", () => {
    const rng = rngNext(rngFromSeed(3)).rng;
    const copy = JSON.parse(JSON.stringify(rng));
    expect(rngNext(copy)).toEqual(rngNext(rng));
  });

  it("rngInt stays in [0, n)", () => {
    let rng = rngFromSeed(9);
    for (let i = 0; i < 200; i++) {
      const r = rngInt(rng, 7);
      rng = r.rng;
      expect(Number.isInteger(r.value) && r.value >= 0 && r.value < 7).toBe(
        true,
      );
    }
  });

  it("yields values in [0, 1)", () => {
    const next = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
