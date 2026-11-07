import { afterEach, describe, expect, it } from "vitest";
import { clearHeld, heldRun, holdRun } from "./heldRun";
import { createRun } from "./run";

const make = () => createRun({ seed: 1, now: () => 0 });

afterEach(() => clearHeld());

describe("heldRun", () => {
  it("holds nothing at first", () => {
    expect(heldRun()).toBeNull();
  });
  it("holds a run, and a new one replaces it", () => {
    const a = make();
    const b = make();
    holdRun(a);
    expect(heldRun()).toBe(a);
    holdRun(b);
    expect(heldRun()).toBe(b);
  });
  it("clears the held run", () => {
    holdRun(make());
    clearHeld();
    expect(heldRun()).toBeNull();
  });
  it("clears only its own run when given one", () => {
    const old = make();
    const current = make();
    holdRun(current);
    clearHeld(old);
    expect(heldRun()).toBe(current);
    clearHeld(current);
    expect(heldRun()).toBeNull();
  });
});
