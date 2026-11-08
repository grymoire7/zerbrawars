import { organismList, organismName } from "../sim/organisms";
import { PARAMS } from "../sim/params";
import { wallOf, type PathogenKindId } from "../sim/pathogens";
import type { BattleGrade, BattleState } from "../sim/types";
import { GRADE, type CompareRow } from "../ui/outcome";
import type { ArcDef } from "./arcs";
import { tissueState } from "./battleModel";
import { medDoses, medStateWord } from "./lifeModel";

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

/** One line of a result block: "Tissue", "15 of 20, strained". `kind` marks an organism's row. */
export interface Reading {
  readonly label: string;
  readonly value: string;
  readonly kind?: PathogenKindId;
}

/** What part A ended on, as the story card prints it and Part B's table compares it. */
export interface PartAReadings {
  /** The result word. Part A has no score and no grade letter. */
  readonly result: string;
  readonly rows: readonly Reading[];
}

export const PART_A_RESULT = "Not finished";

/** "15 of 20, strained": the number and its honest word. */
const tissueText = (tissue: number) =>
  `${tissue} of ${PARAMS.maxTissueHealth}, ${tissueState(tissue)}`;

const whereLeft = (b: BattleState, kind: PathogenKindId): string =>
  b.swarms.some((s) => s.load.some((c) => c.kind === kind))
    ? "still there, inside your cells"
    : b.granulomas.some((g) => g.contents.some((c) => c.kind === kind))
      ? "still there, walled off"
      : "still there";

/**
 * Part A's readings: each organism that was on the first board (finished, or still there and
 * where), the infection, tissue as a number with its word, and no medication. The infection reads
 * "not finished, still sick" so the tissue reading can stay truthful (it can say 18 of 20).
 */
export function partAReadings(
  initial: BattleState,
  final: BattleState,
): PartAReadings {
  const end = kindsOf(final);
  const kinds = [...new Set(initial.pathogens.map((p) => p.kind))];
  return {
    result: PART_A_RESULT,
    rows: [
      ...kinds.map((kind) => ({
        label: organismName(kind),
        value: end.has(kind) ? whereLeft(final, kind) : "finished",
        kind,
      })),
      { label: "Infection", value: "not finished, still sick" },
      { label: "Tissue", value: tissueText(final.tissueHealth) },
      { label: "Medication", value: "none" },
    ],
  };
}

/** The readings as the story card's outcome paragraph: the result word, then a line per row. */
export const readingsBlock = (r: PartAReadings): string =>
  [r.result, ...r.rows.map((x) => `${x.label}: ${x.value}`)].join("\n");

/** Shown instead of the table when Part A was skipped. */
export const SKIPPED_LINE = "Before the diagnosis, this germ was not finished.";

/**
 * Part B's before and now table: Result, the shelled germ's row, Tissue and Medication. Empty when
 * Part A was skipped (`before` undefined). It shows for any grade, so a Contained or Backup arrived
 * ending still has the comparison; the Result row carries a lower tissue, which stays honest.
 */
export function compareRows(
  before: PartAReadings | undefined,
  final: BattleState,
  grade: BattleGrade,
): CompareRow[] {
  if (!before) return [];
  const end = kindsOf(final);
  const doses = medDoses(final.meds.level);
  const window = PARAMS.life.meds.window;
  const shelled = before.rows.filter(
    (r) => r.kind && wallOf({ kind: r.kind }) === "sealed",
  );
  const was = (label: string) =>
    before.rows.find((r) => r.label === label)?.value ?? "";
  return [
    { label: "Result", before: before.result, now: GRADE[grade].title },
    ...shelled.map((r) => ({
      label: r.label,
      before: r.value,
      now: end.has(r.kind!) ? whereLeft(final, r.kind!) : "finished",
    })),
    {
      label: "Tissue",
      before: was("Tissue"),
      now: tissueText(final.tissueHealth),
    },
    {
      label: "Medication",
      before: was("Medication"),
      now: `${doses} of ${window}, ${medStateWord(doses, window)}`,
    },
  ];
}

/**
 * Part B's outcome card text, from the arc: All clear and Contained have their own words. Backup
 * arrived keeps the standard card's kind line, so this is undefined for it.
 */
export function partBSummary(
  arc: ArcDef,
  grade: BattleGrade,
  backup: boolean,
): string | undefined {
  const play = arc.play;
  if (play.kind !== "tutorial" || backup) return undefined;
  if (grade === "cleared") return play.endClear;
  return grade === "contained" ? play.endHeld : undefined;
}
