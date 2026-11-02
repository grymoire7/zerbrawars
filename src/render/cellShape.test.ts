import { describe, expect, it } from "vitest";
import { CELL_POINTS, cellHash, cellOutline, outlineArea } from "./cellShape";

describe("cellOutline", () => {
  it("is deterministic per tile and differs between tiles", () => {
    expect(cellOutline(3, 4)).toEqual(cellOutline(3, 4));
    expect(cellOutline(3, 4)).not.toEqual(cellOutline(4, 3));
  });

  it("stays inside the tile footprint with a gap, and keeps most of the area", () => {
    for (let x = 0; x < 7; x++) {
      for (let y = 0; y < 7; y++) {
        const pts = cellOutline(x, y);
        for (const p of pts) {
          expect(Math.abs(p.x)).toBeLessThanOrEqual(0.47);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(0.47);
          expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(0.53);
        }
        expect(outlineArea(pts)).toBeGreaterThanOrEqual(0.62);
      }
    }
  });

  it("is a closed loop of distinct, finite points", () => {
    const pts = cellOutline(0, 0);
    expect(pts).toHaveLength(CELL_POINTS);
    const keys = new Set(pts.map((p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`));
    expect(keys.size).toBe(CELL_POINTS);
    for (const p of pts) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
    // Consecutive points are close, so closing the loop adds no long jump.
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.3);
    }
  });
});

describe("cellHash", () => {
  it("is stable and within 0..1", () => {
    expect(cellHash(2, 5)).toBe(cellHash(2, 5));
    expect(cellHash(2, 5, 1)).not.toBe(cellHash(2, 5, 0));
    const v = cellHash(6, 6);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
