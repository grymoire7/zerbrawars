import { describe, expect, it } from "vitest";
import { BOTS, playBattle } from "../sim/battle/bots";
import { organismName } from "../sim/organisms";
import { loadScenario, TUTORIAL_SEED } from "../sim/scenarios";
import type { BattleState } from "../sim/types";
import { ARCS } from "./arcs";
import {
  afterPart,
  introCardFor,
  parseTutorialPart,
  partAResult,
  partAStoryCard,
  partAfterIntro,
  STORY_BUTTON,
  STORY_TITLE,
} from "./tutorialModel";

const A = () => loadScenario("tutorial-a", TUTORIAL_SEED) as BattleState;
const text = (c: { paragraphs: readonly string[] }) => c.paragraphs.join(" ");

describe("the intro card", () => {
  it("shows the arc intro, then the story setup, with Begin and a skip", () => {
    const arc = ARCS[0]!;
    const card = introCardFor(arc);
    expect(card.title).toBe("Before anyone knew");
    expect(card.paragraphs[0]).toBe(arc.intro);
    expect(card.paragraphs.length).toBeGreaterThan(1);
    expect(card.begin).toBe("Begin");
    expect(card.skip).toBe("Skip to after the diagnosis");
  });
  it("is generic: an arc with no skip gets Begin only", () => {
    const card = introCardFor({
      ...ARCS[1]!,
      play: { kind: "battle", scenario: "tutorial-a" },
    });
    expect(card).toEqual({
      title: ARCS[1]!.title,
      paragraphs: [ARCS[1]!.intro],
      begin: "Begin",
    });
  });
  it("Arc 2 opens with its own card: four short paragraphs, Begin, no skip", () => {
    const arc = ARCS[1]!;
    const card = introCardFor(arc);
    expect(card.title).toBe("A first summer");
    expect(card.paragraphs[0]).toBe(arc.intro);
    expect(card.paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(card.paragraphs.length).toBeLessThanOrEqual(6);
    for (const p of card.paragraphs) expect(p.length).toBeLessThan(200);
    expect(card.begin).toBe("Begin");
    expect(card.skip).toBeUndefined();
    const all = text(card);
    expect(all).toMatch(/13 living points/);
    expect(all).toMatch(/Goals met/);
    expect(all).toMatch(/two weeks/i);
    expect(all).toMatch(/Exposure/);
    expect(all).toMatch(/luck matters/);
    expect(all).toMatch(/defends itself/);
    expect(all).not.toMatch(/lost|fail|defeat|your fault|\bwin\b|\blose\b/i);
  });
  it("Arc 1's card is unchanged", () => {
    expect(introCardFor(ARCS[0]!)).toEqual({
      title: "Before anyone knew",
      paragraphs: [
        "Some people remember the time before they knew they had CGD. Some were too little to remember. Either way, it often goes something like this.",
        "A germ got into your lungs, and your cells rushed in to deal with it.",
      ],
      begin: "Begin",
      skip: "Skip to after the diagnosis",
    });
  });
});

describe("what follows what", () => {
  it("Begin plays part A, Skip goes straight to B, and B ends the arc", () => {
    expect(partAfterIntro("begin")).toBe("a");
    expect(partAfterIntro("skip")).toBe("b");
    expect(afterPart("a")).toBe("b");
    expect(afterPart("b")).toBe("complete");
  });
  it("reads ?part=b only", () => {
    expect(parseTutorialPart(new URLSearchParams("part=b"))).toBe("b");
    expect(parseTutorialPart(new URLSearchParams("part=a"))).toBeUndefined();
    expect(parseTutorialPart(new URLSearchParams(""))).toBeUndefined();
  });
});

describe("part A's story card", () => {
  it("names the finished strep and the unfinished mold for a player who acts", () => {
    const initial = A();
    const final = playBattle(BOTS.engulfAll!, A(), 1);
    const r = partAResult(initial, final.final);
    const card = partAStoryCard(r);
    expect(r.left).toEqual(["aspergillus"]);
    expect(card.title).toBe(STORY_TITLE);
    expect(card.button).toBe(STORY_BUTTON);
    expect(text(card)).toContain(organismName("aspergillus"));
    expect(text(card)).toMatch(/kept coming back/);
    expect(text(card)).toMatch(/The missing tool had a name: CGD/);
  });
  it("says what is left even when the player did nothing", () => {
    const initial = A();
    const r = partAResult(initial, playBattle(BOTS.hold!, A(), 1).final);
    expect(r.finished).toEqual([]);
    expect(r.left).toContain("aspergillus");
    expect(text(partAStoryCard(r))).not.toMatch(/finished off/);
    expect(text(partAStoryCard(r))).toMatch(/kept coming back/);
  });
  it("falls back to the plain line when nothing shelled is left", () => {
    const card = partAStoryCard({ finished: ["strep"], left: [] });
    expect(text(card)).toContain(
      `They finished off the ${organismName("strep")} with no trouble.`,
    );
    expect(text(card)).toMatch(/took everything they had/);
    expect(text(card)).not.toMatch(/kept coming back/);
  });
  it("slots a clear outcome and a score line in without moving anything else", () => {
    const base = partAStoryCard({ finished: [], left: ["aspergillus"] });
    const slotted = partAStoryCard(
      { finished: [], left: ["aspergillus"] },
      { outcome: "OUTCOME", score: "SCORE" },
    );
    expect(
      slotted.paragraphs.filter((p) => !["OUTCOME", "SCORE"].includes(p)),
    ).toEqual(base.paragraphs);
    const i = slotted.paragraphs.indexOf("OUTCOME");
    expect(slotted.paragraphs[i + 1]).toBe("SCORE");
    expect(slotted.paragraphs[i - 1]).toMatch(/kept coming back/);
  });
});
