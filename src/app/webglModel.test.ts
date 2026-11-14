import { describe, expect, it } from "vitest";
import { webglAvailable } from "./webglModel";

describe("webglAvailable", () => {
  it("is true when a context comes back", () => {
    expect(webglAvailable(() => ({}))).toBe(true);
  });
  it("falls back from webgl2 to webgl", () => {
    expect(webglAvailable((k) => (k === "webgl" ? {} : null))).toBe(true);
  });
  it("is false when none or a throw", () => {
    expect(webglAvailable(() => null)).toBe(false);
    expect(
      webglAvailable(() => {
        throw new Error("blocked");
      }),
    ).toBe(false);
  });
});
