/**
 * Organic cell outlines (B1a design spec, section 5). Pure: no three import.
 * The logical grid stays square; only the drawn shape of each tile is irregular. Coordinates are
 * relative to the tile centre, in tile units (a tile is 1 wide), x right and y toward the viewer.
 */

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

export const CELL_POINTS = 28;
const EXPONENT = 4;
const RADIUS = 0.42;
const JITTER = 0.025;
const HARMONICS = [2, 3, 5] as const;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (x: number, y: number) =>
  ((x * 73856093) ^ (y * 19349663)) >>> 0;

/** A stable 0..1 number per tile (for phases and tiny shade offsets), from the same seed. */
export function cellHash(x: number, y: number, salt = 0): number {
  const rand = mulberry32(seedOf(x, y) + Math.imul(salt, 0x9e3779b1));
  rand();
  return rand();
}

/** 28 points, counter-clockwise on a rounded square with a smooth radial wobble of at most 0.025. */
export function cellOutline(x: number, y: number): Point2[] {
  const rand = mulberry32(seedOf(x, y));
  const share = JITTER / HARMONICS.length;
  const waves = HARMONICS.map((k) => ({
    k,
    amp: share * (0.5 + 0.5 * rand()),
    phase: rand() * Math.PI * 2,
  }));
  const pts: Point2[] = [];
  for (let i = 0; i < CELL_POINTS; i++) {
    const t = (i / CELL_POINTS) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const px = RADIUS * Math.sign(c) * Math.abs(c) ** (2 / EXPONENT);
    const py = RADIUS * Math.sign(s) * Math.abs(s) ** (2 / EXPONENT);
    const dist = Math.hypot(px, py);
    let jitter = 0;
    for (const w of waves) jitter += w.amp * Math.sin(w.k * t + w.phase);
    const scale = (dist + jitter) / dist;
    pts.push({ x: px * scale, y: py * scale });
  }
  return pts;
}

/** Shoelace area of an outline, for tests. */
export function outlineArea(pts: readonly Point2[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}
