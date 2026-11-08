import { describe, expect, it } from "vitest";
import {
  escapeAction,
  leaveNote,
  menuItems,
  startOverConfirm,
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

describe("whereLines in the tutorial", () => {
  it("names the part", () => {
    expect(whereLines({ arc: "tutorial", variant: "xl", part: "a" }).line).toBe(
      "First infection, before the diagnosis",
    );
    expect(whereLines({ arc: "tutorial", variant: "xl", part: "b" }).line).toBe(
      "First infection, after the diagnosis",
    );
  });
});

describe("leaveNote", () => {
  it("says a summer is kept", () => {
    expect(leaveNote("summer")).toMatch(/Your summer waits/);
  });
  it("does not promise a finished summer waits", () => {
    expect(leaveNote("summer", true)).toMatch(/finished/);
  });
  it("says a single fight is not kept", () => {
    expect(leaveNote("tutorial")).toMatch(/not kept/);
  });
});

describe("menuItems", () => {
  it("offers both start-overs in a battle of Arc 2", () => {
    expect(
      menuItems({ arc: "summer", screen: "battle", fightOver: false }),
    ).toEqual([
      "help",
      "restartFight",
      "restartSummer",
      "chooseArc",
      "changeCharacter",
    ]);
  });
  it("offers only the summer on the life screen", () => {
    expect(
      menuItems({ arc: "summer", screen: "life", fightOver: false }),
    ).toEqual(["help", "restartSummer", "chooseArc", "changeCharacter"]);
  });
  it("offers only the fight in Arc 1", () => {
    expect(
      menuItems({ arc: "tutorial", screen: "battle", fightOver: false }),
    ).toEqual(["help", "restartFight", "chooseArc", "changeCharacter"]);
  });
  it("offers no start-over on the quiet week or the summary", () => {
    expect(
      menuItems({ arc: "summer", screen: "interlude", fightOver: false }),
    ).toEqual(["help", "chooseArc", "changeCharacter"]);
  });
  it("drops the fight once it is over", () => {
    expect(
      menuItems({ arc: "summer", screen: "battle", fightOver: true }),
    ).toEqual(["help", "restartSummer", "chooseArc", "changeCharacter"]);
    expect(
      menuItems({ arc: "tutorial", screen: "battle", fightOver: true }),
    ).toEqual(["help", "chooseArc", "changeCharacter"]);
  });
  it("always keeps both leave items, with no Back to the title", () => {
    for (const arc of ["summer", "tutorial"] as const)
      for (const screen of ["life", "battle"] as const) {
        const items = menuItems({ arc, screen, fightOver: true });
        expect(items.slice(-2)).toEqual(["chooseArc", "changeCharacter"]);
      }
  });
});

describe("startOverConfirm", () => {
  it("asks about the fight from turn 1 and says the week is kept in Arc 2", () => {
    const c = startOverConfirm("restartFight", "summer");
    expect(c.question).toBe("Start this fight over from turn 1?");
    expect(c.detail).toMatch(/week and its score so far are kept/);
    expect(startOverConfirm("restartFight", "tutorial").detail).not.toMatch(
      /week/,
    );
  });
  it("asks about the summer from week 1 and says it is lost", () => {
    const c = startOverConfirm("restartSummer", "summer");
    expect(c.question).toBe("Start this summer over from week 1?");
    expect(c.detail).toMatch(/will be lost/);
    expect(c.keep).toBe("Keep playing");
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
