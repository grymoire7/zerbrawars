/** Mulberry32 state as plain data, so it can live inside serialized sim state. */
export interface RngState {
  readonly state: number;
}

export function rngFromSeed(seed: number): RngState {
  return { state: seed >>> 0 };
}

/** One mulberry32 step: a float in [0, 1) and the advanced state. */
export function rngNext(rng: RngState): { value: number; rng: RngState } {
  const a = (rng.state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, rng: { state: a } };
}

/** An integer in [0, n). */
export function rngInt(
  rng: RngState,
  n: number,
): { value: number; rng: RngState } {
  const r = rngNext(rng);
  return { value: Math.floor(r.value * n), rng: r.rng };
}

/** Seeded PRNG (mulberry32). Returns a function yielding floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let rng = rngFromSeed(seed);
  return () => {
    const r = rngNext(rng);
    rng = r.rng;
    return r.value;
  };
}
