import { describe, expect, it } from "vitest";
import { BEST_KEY } from "./bestScores";
import {
  NEW_PLAYER_KEYS,
  RESET_CONFIRM,
  clearNewPlayerData,
  clearedLine,
  exportFirst,
  logFileName,
  parseFacilitator,
  titleExport,
} from "./facilitatorModel";

describe("parseFacilitator", () => {
  it("is on only for facilitator=1", () => {
    expect(parseFacilitator(new URLSearchParams("facilitator=1"))).toBe(true);
    expect(parseFacilitator(new URLSearchParams("facilitator=0"))).toBe(false);
    expect(parseFacilitator(new URLSearchParams("arc=2"))).toBe(false);
  });
});

describe("what shows when", () => {
  it("offers export-first only with the flag and a log", () => {
    expect(exportFirst(true, true)?.line).toBe(
      "The session log goes with it. Export it first?",
    );
    expect(exportFirst(false, true)).toBeNull();
    expect(exportFirst(true, false)).toBeNull();
  });
  it("offers the title export only with the flag and a held run", () => {
    expect(titleExport(true, true)?.label).toBe("Export log");
    expect(titleExport(true, false)).toBeNull();
    expect(titleExport(false, true)).toBeNull();
  });
  it("uses the design's words for the reset confirm", () => {
    expect(RESET_CONFIRM.question).toBe(
      "Clear best scores and first-time help for a new player?",
    );
    expect([RESET_CONFIRM.keep, RESET_CONFIRM.go]).toEqual(["Cancel", "Clear"]);
  });
  it("says what was cleared", () => {
    expect(clearedLine(true)).toContain("waiting summer");
    expect(clearedLine(false)).not.toContain("summer");
  });
  it("names the file by seed", () => {
    expect(logFileName(7)).toBe("zebrawars-session-seed7.json");
  });
});

describe("clearNewPlayerData", () => {
  it("removes best scores and both help flags, and leaves other keys", () => {
    const data = new Map<string, string>([
      [BEST_KEY, "{}"],
      ["zebrawars.help.seen", "1"],
      ["zebrawars.help.life.seen", "1"],
      ["other", "keep"],
    ]);
    clearNewPlayerData({ removeItem: (k) => void data.delete(k) });
    expect([...data.keys()]).toEqual(["other"]);
    expect(NEW_PLAYER_KEYS).toHaveLength(3);
  });
  it("survives missing or blocked storage", () => {
    expect(() => clearNewPlayerData(null)).not.toThrow();
    expect(() =>
      clearNewPlayerData({
        removeItem() {
          throw new Error("blocked");
        },
      }),
    ).not.toThrow();
  });
});
