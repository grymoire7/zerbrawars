import { describe, expect, it } from "vitest";
import {
  EPILOGUE_DRAFT,
  EPILOGUE_ENABLED,
  epilogueCard,
  parseEpilogue,
} from "./epilogue";

describe("epilogueCard", () => {
  const card = epilogueCard();
  const text = [card.title, card.draft, ...card.paragraphs].join(" ");

  it("has 3 to 5 short paragraphs", () => {
    expect(card.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(card.paragraphs.length).toBeLessThanOrEqual(5);
    for (const p of card.paragraphs) expect(p.length).toBeLessThan(200);
  });
  it("carries the draft marker", () => {
    expect(card.draft).toBe(EPILOGUE_DRAFT);
    expect(card.draft).toMatch(/pending clinical review/);
  });
  it("says it is information and points to the care team", () => {
    expect(text).toMatch(/not medical advice/);
    expect(text).toMatch(/care team/);
  });
  it("avoids blame, fear and advertising words", () => {
    for (const w of [
      "lost",
      "failed",
      "defeat",
      "wait",
      "second best",
      "scary",
      "dangerous",
      "afraid",
      "fear",
      "cure",
      "best option",
    ])
      expect(text.toLowerCase()).not.toContain(w);
  });
  it("uses only the allowed numbers", () => {
    const nums = (text.match(/\d+/g) ?? []).map(Number).sort();
    expect(nums).toEqual([20, 30, 70]);
  });
  it("hedges the gene therapy figures", () => {
    expect(text).toMatch(/early results/);
    expect(text).toMatch(/one recent patient/);
  });
});

describe("parseEpilogue", () => {
  const q = (s: string) => new URLSearchParams(s);
  it("follows the constant by default", () => {
    expect(parseEpilogue(q(""))).toBe(EPILOGUE_ENABLED);
    expect(parseEpilogue(q(""), false)).toBe(false);
  });
  it("hides with ?epilogue=0 and shows with ?epilogue=1", () => {
    expect(parseEpilogue(q("epilogue=0"))).toBe(false);
    expect(parseEpilogue(q("epilogue=1"), false)).toBe(true);
  });
  it("ignores other values", () => {
    expect(parseEpilogue(q("epilogue=yes"), false)).toBe(false);
  });
});
