import { describe, expect, it } from "vitest";
import {
  escapeAction,
  leaveQuestion,
  trapIndex,
  whereLines,
} from "./gameMenuModel";

describe("whereLines", () => {
  it("names the arc, the week and the character", () => {
    expect(
      whereLines({
        arc: "summer",
        variant: "xl",
        week: { cycle: 1, cycles: 2 },
      }),
    ).toEqual({
      line: "A first summer · week 1 of 2",
      sub: "CGD, X-linked",
    });
  });
  it("leaves the week out of a single fight", () => {
    expect(whereLines({ arc: "tutorial", variant: "ar" })).toEqual({
      line: "First infection",
      sub: "CGD, autosomal recessive",
    });
  });
});

describe("leaveQuestion", () => {
  it("is warm and says what ends", () => {
    expect(leaveQuestion("summer")).toBe(
      "Head back to the title? This summer will end here.",
    );
    expect(leaveQuestion("tutorial")).toMatch(/fight will end here/);
  });
});

describe("escapeAction", () => {
  const base = { menuOpen: false, otherOpen: false, pick: false };
  it("closes an open menu first", () => {
    expect(escapeAction({ ...base, menuOpen: true, pick: true })).toBe(
      "closeMenu",
    );
  });
  it("leaves Escape to another open dialog", () => {
    expect(escapeAction({ ...base, otherOpen: true })).toBe("none");
  });
  it("cancels a pick before opening the menu", () => {
    expect(escapeAction({ ...base, pick: true })).toBe("cancelPick");
    expect(escapeAction(base)).toBe("openMenu");
  });
});

describe("trapIndex", () => {
  it("wraps forwards and backwards", () => {
    expect(trapIndex(2, 3, false)).toBe(0);
    expect(trapIndex(0, 3, true)).toBe(2);
    expect(trapIndex(0, 3, false)).toBe(1);
  });
  it("starts at an end when focus is outside", () => {
    expect(trapIndex(-1, 3, false)).toBe(0);
    expect(trapIndex(-1, 3, true)).toBe(2);
    expect(trapIndex(0, 0, false)).toBe(-1);
  });
});
