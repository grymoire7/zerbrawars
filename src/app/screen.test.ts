import { describe, expect, it } from "vitest";
import { parseMode } from "./screen";

describe("parseMode", () => {
  it("defaults to the campaign", () => {
    expect(parseMode(new URLSearchParams(""))).toBe("campaign");
    expect(parseMode(new URLSearchParams("mode=nope"))).toBe("campaign");
  });
  it("keeps the standalone debug entries", () => {
    expect(parseMode(new URLSearchParams("mode=life"))).toBe("life");
    expect(parseMode(new URLSearchParams("mode=battle"))).toBe("battle");
  });
});
