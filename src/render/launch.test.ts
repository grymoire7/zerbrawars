import { describe, expect, it } from "vitest";
import { clientToNdc, hitPlane } from "./launch";

describe("hitPlane", () => {
  it("finds where a downward sight line meets the plane", () => {
    const p = hitPlane({ x: 0, y: 10, z: 0 }, { x: 1, y: -1, z: 2 }, 2)!;
    expect(p).toEqual({ x: 8, y: 2, z: 16 });
  });
  it("is null for a level or upward line", () => {
    expect(hitPlane({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }, 2)).toBeNull();
    expect(hitPlane({ x: 0, y: 10, z: 0 }, { x: 1, y: 1, z: 0 }, 2)).toBeNull();
  });
  it("is null when the plane is above the origin", () => {
    expect(hitPlane({ x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, 5)).toBeNull();
  });
});

describe("clientToNdc", () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };
  it("maps the corners and centre, with y up", () => {
    expect(clientToNdc(300, 150, rect)).toEqual({ x: 0, y: 0 });
    expect(clientToNdc(500, 50, rect)).toEqual({ x: 1, y: 1 });
    expect(clientToNdc(100, 250, rect)).toEqual({ x: -1, y: -1 });
  });
  it("is null for an empty canvas", () => {
    expect(clientToNdc(0, 0, { ...rect, width: 0 })).toBeNull();
  });
});
