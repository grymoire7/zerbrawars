import { describe, expect, it } from "vitest";
import {
  GUARD_STATE,
  backAction,
  historyStep,
  isGuardState,
  shouldWarnOnLeave,
} from "./navGuardModel";

const closed = { menuOpen: false, helpOpen: false, blocked: false };

describe("backAction", () => {
  it("opens the menu during play", () => {
    expect(backAction(closed)).toBe("openMenu");
  });
  it("closes the menu when it is open", () => {
    expect(backAction({ ...closed, menuOpen: true })).toBe("closeMenu");
  });
  it("closes help when only help is open", () => {
    expect(backAction({ ...closed, helpOpen: true })).toBe("closeHelp");
  });
  it("leaves a blocking question alone", () => {
    expect(backAction({ ...closed, blocked: true })).toBe("none");
  });
});

describe("shouldWarnOnLeave", () => {
  it("asks for a held summer or an arc fight", () => {
    expect(shouldWarnOnLeave({ held: true, arcFightInPlay: false })).toBe(true);
    expect(shouldWarnOnLeave({ held: false, arcFightInPlay: true })).toBe(true);
  });
  it("asks nothing when nothing would be lost", () => {
    expect(shouldWarnOnLeave({ held: false, arcFightInPlay: false })).toBe(
      false,
    );
  });
});

describe("historyStep", () => {
  it("pushes one guard entry and never a second", () => {
    expect(historyStep({ wantGuard: true, onGuardEntry: false })).toBe("push");
    expect(historyStep({ wantGuard: true, onGuardEntry: true })).toBe("none");
  });
  it("pops the guard entry when leaving play, and only then", () => {
    expect(historyStep({ wantGuard: false, onGuardEntry: true })).toBe("pop");
    expect(historyStep({ wantGuard: false, onGuardEntry: false })).toBe("none");
  });
  it("recognises the marker", () => {
    expect(isGuardState(GUARD_STATE)).toBe(true);
    expect(isGuardState(null)).toBe(false);
    expect(isGuardState({})).toBe(false);
  });
});
