import { describe, expect, it } from "vitest";
import {
  gazeFor,
  nextBlinkDelayMs,
  screenKindFor,
  uniquifyIds,
} from "./zoreoModel";
import type { ArcId } from "./arcs";
import type { Run } from "./run";

const run = {} as Run;
const playOf = (a: ArcId) => (a === "tutorial" ? "tutorial" : "campaign");

describe("screenKindFor", () => {
  it("treats campaign and life requests as life", () => {
    expect(screenKindFor({ mode: "campaign" }, playOf)).toBe("life");
    expect(screenKindFor({ mode: "life", run }, playOf)).toBe("life");
  });
  it("treats a standalone life (no run) as life", () => {
    expect(screenKindFor({ mode: "life" }, playOf)).toBe("life");
  });
  it("treats battle requests as battle, with or without a run", () => {
    expect(screenKindFor({ mode: "battle" }, playOf)).toBe("battle");
    expect(screenKindFor({ mode: "battle", run }, playOf)).toBe("battle");
  });
  it("treats quiet, summary and epilogue as interlude", () => {
    for (const mode of ["quiet", "summary", "epilogue"] as const)
      expect(screenKindFor({ mode, run }, playOf)).toBe("interlude");
  });
  it("treats title, arcs, arcComplete and arcIntro as menu", () => {
    expect(screenKindFor({ mode: "title" }, playOf)).toBe("menu");
    expect(screenKindFor({ mode: "arcs", variant: "xl" }, playOf)).toBe("menu");
    expect(
      screenKindFor(
        { mode: "arcComplete", arc: "summer", variant: "xl" },
        playOf,
      ),
    ).toBe("menu");
    expect(
      screenKindFor({ mode: "arcIntro", arc: "summer", variant: "xl" }, playOf),
    ).toBe("menu");
  });
  it("treats a campaign arc as menu before its intro is seen and life after", () => {
    const base = { mode: "arcPlay", arc: "summer", variant: "xl" } as const;
    expect(screenKindFor(base, playOf)).toBe("menu");
    expect(screenKindFor({ ...base, introSeen: true }, playOf)).toBe("life");
  });
  it("treats a tutorial arc as menu without a part and battle with one", () => {
    const base = { mode: "arcPlay", arc: "tutorial", variant: "xl" } as const;
    expect(screenKindFor(base, playOf)).toBe("menu");
    expect(screenKindFor({ ...base, part: "a" }, playOf)).toBe("battle");
    expect(screenKindFor({ ...base, part: "b" }, playOf)).toBe("battle");
  });
  it("treats a single-battle arc as battle", () => {
    expect(
      screenKindFor(
        { mode: "arcPlay", arc: "summer", variant: "xl" },
        () => "battle",
      ),
    ).toBe("battle");
  });
});

describe("gazeFor", () => {
  it("looks at the panel in life, at the board in battle, and is hidden elsewhere", () => {
    expect(gazeFor("life")).toBe("panel");
    expect(gazeFor("battle")).toBe("board");
    expect(gazeFor("interlude")).toBeNull();
    expect(gazeFor("menu")).toBeNull();
  });
});

describe("uniquifyIds", () => {
  const svg =
    '<svg><defs><linearGradient id="zo-a"/></defs>' +
    '<path fill="url(#zo-a)"/><use href="#zo-a"/><g class="zo-lid"/></svg>';
  it("rewrites ids and their references but not classes", () => {
    const out = uniquifyIds(svg, "c1");
    expect(out).toContain('id="c1-a"');
    expect(out).toContain("url(#c1-a)");
    expect(out).toContain('href="#c1-a"');
    expect(out).toContain('class="zo-lid"');
    expect(out).not.toContain('id="zo-a"');
  });
  it("gives two copies no id in common", () => {
    const ids = (s: string) =>
      [...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    const a = ids(uniquifyIds(svg, "c1"));
    const b = ids(uniquifyIds(svg, "t2"));
    expect(a.filter((id) => b.includes(id))).toEqual([]);
  });
});

describe("nextBlinkDelayMs", () => {
  it("stays between 2500 and 6000 ms across the whole range of rand", () => {
    for (const r of [0, 0.5, 0.999999]) {
      const d = nextBlinkDelayMs(r);
      expect(d).toBeGreaterThanOrEqual(2500);
      expect(d).toBeLessThanOrEqual(6000);
    }
  });
});
