import { describe, expect, it } from "vitest";
import { parseMode } from "./screen";

describe("parseMode", () => {
  it("defaults to the battle", () => {
    expect(parseMode(new URLSearchParams(""))).toBe("battle");
    expect(parseMode(new URLSearchParams("mode=nope"))).toBe("battle");
  });
  it("reads life", () => {
    expect(parseMode(new URLSearchParams("mode=life"))).toBe("life");
  });
});
