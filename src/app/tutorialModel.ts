import { organismList } from "../sim/organisms";
import { wallOf, type PathogenKindId } from "../sim/pathogens";
import type { BattleState } from "../sim/types";
import type { ArcDef } from "./arcs";

// The pure side of Arc 1's tutorial: the intro card, what follows what, and the story card that
// ends part A. The screens only draw it.

/** Arc 1's two fights: A before the diagnosis, B after it. */
export type TutorialPart = "a" | "b";

/** How each part is named in the game menu: "First infection, before the diagnosis". */
export const PART_LABEL: Record<TutorialPart, string> = {
  a: "before the diagnosis",
  b: "after the diagnosis",
};

/** `?part=b` (debug) starts Part B; anything else starts at the intro. */
export const parseTutorialPart = (
  params: URLSearchParams,
): TutorialPart | undefined => (params.get("part") === "b" ? "b" : undefined);

/** A card before an arc: a title, paragraphs, and a Begin button with an optional secondary one. */
export interface IntroCard {
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly begin: string;
  readonly skip?: string;
}

/**
 * The card an arc opens with. It is data: any arc gets one from its `intro`; a tutorial arc adds
 * its own title, extra paragraphs and the skip button.
 */
export function introCardFor(arc: ArcDef): IntroCard {
  const play = arc.play;
  if (play.kind === "tutorial")
    return {
      title: play.introTitle,
      paragraphs: [arc.intro, ...play.introMore],
      begin: play.begin,
      skip: play.skip,
    };
  return { title: arc.title, paragraphs: [arc.intro], begin: "Begin" };
}

/** Which part an intro button starts: Begin plays from the top, Skip goes straight to B. */
export const partAfterIntro = (button: "begin" | "skip"): TutorialPart =>
  button === "begin" ? "a" : "b";

/** What follows a part: A goes on to B (through its story card); B ends the arc. */
export const afterPart = (part: TutorialPart): TutorialPart | "complete" =>
  part === "a" ? "b" : "complete";

/** What part A left behind, from the first board and the last one. */
export interface PartAResult {
  /** Shell-less kinds that were on the board at the start and are gone. */
  readonly finished: readonly PathogenKindId[];
  /** Shelled kinds still there: free on the board, carried inside a swarm, or walled off. */
  readonly left: readonly PathogenKindId[];
}

const kindsOf = (b: BattleState): Set<PathogenKindId> =>
  new Set([
    ...b.pathogens.map((p) => p.kind),
    ...b.swarms.flatMap((s) => s.load.map((c) => c.kind)),
    ...b.granulomas.flatMap((g) => g.contents.map((c) => c.kind)),
  ]);

export function partAResult(
  initial: BattleState,
  final: BattleState,
): PartAResult {
  const start = new Set(initial.pathogens.map((p) => p.kind));
  const end = kindsOf(final);
  return {
    finished: [...start].filter(
      (k) => wallOf({ kind: k }) === "leaky" && !end.has(k),
    ),
    left: [...end].filter((k) => wallOf({ kind: k }) === "sealed"),
  };
}

export const STORY_TITLE = "The day it got a name";
export const STORY_BUTTON = "See what changes";

/** Extra lines that can be slotted into the story card later: a clear outcome and a score. */
export interface StorySlots {
  readonly outcome?: string;
  readonly score?: string;
}

export interface StoryCard {
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly button: string;
}

/**
 * Part A's ending card (it replaces the outcome card and is the bridge to part B). The conditional
 * lines come from `result`, with names from organismName() through organismList(); `slots` adds a
 * clear outcome line and a score line after them without changing anything else.
 */
export function partAStoryCard(
  result: PartAResult,
  slots: StorySlots = {},
): StoryCard {
  const middle =
    result.left.length > 0
      ? `But the ${organismList(result.left)} kept coming back. Your cells were missing one tool to finish it.`
      : "They got there in the end, but it took everything they had.";
  return {
    title: STORY_TITLE,
    paragraphs: [
      "Your cells did everything they could. They came fast and swallowed the germs.",
      ...(result.finished.length > 0
        ? [
            `They finished off the ${organismList(result.finished)} with no trouble.`,
          ]
        : []),
      middle,
      ...(slots.outcome ? [slots.outcome] : []),
      ...(slots.score ? [slots.score] : []),
      "The doctors helped your body clear it, and ran some tests. The missing tool had a name: CGD. And with a name came a plan.",
    ],
    button: STORY_BUTTON,
  };
}
