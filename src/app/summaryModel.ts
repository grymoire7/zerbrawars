import type { CycleRecord, CycleResult } from "../sim/campaign";
import type { LifeState } from "../sim/life/types";
import type { CampaignScore, WeekScore } from "../sim/score";
import type { ScoreCardModel } from "../ui/interlude";
import type { RecordResult } from "./bestScores";
import { oddsLabel, type WeekOdds } from "./lifeModel";

// The campaign-complete score view (docs/specs/b1a-design.md 1.6). Plain and non-blaming:
// Choices is "what you chose", Outcome is "how it went"; nothing is subtracted or shamed.

export const SCORE_FRAMING =
  "Infections happen whatever you do. Choices is what you chose, and the part you control. Outcome is how it went, and includes the dice.";

/** The summer's headline (outcomes design 4.3): goals met, said as a fact with no judgement. */
export function goalsHeadline(met: number, of: number): string {
  const word =
    met >= of
      ? "You lived it fully."
      : met === 0
        ? "A quieter summer."
        : met === 1
          ? "One goal met."
          : `${met} goals met.`;
  return `Goals met: ${met} of ${of}. ${word}`;
}

/** One week's Odds row for the summer: the odds, what came home, and how the fight went. */
export function summerOddsRow(h: CycleRecord): string {
  const { value } = oddsLabel(h.exposure);
  const { result } = h;
  const landed =
    result.kind === "battle" && result.reasons.includes("exposure");
  const happened = landed ? "something came home" : "nothing came home";
  let word: string;
  if (result.kind === "quiet") word = "Just a virus, no fight";
  else if (result.battleKind === "skirmish")
    word = result.outcome.grade === "cleared" ? "All quiet" : "Still stirring";
  else word = capital(FIGHT_WORD[result.outcome.grade]);
  return `Odds ${value}, ${happened}. ${word}.`;
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const choicesParts = (w: WeekScore) =>
  `living ${w.choices.living}, odds pushed ${w.choices.dodged}, routine kept ${w.choices.meds}, checked ${w.choices.checked}` +
  (w.choices.goalMet > 0 ? `, goal met +${w.choices.goalMet}` : "");

export const outcomeParts = (w: WeekScore) =>
  `tissue ${w.outcome.tissue}, fight ${w.outcome.fight}, clear ${w.outcome.clear}`;

/** One labelled row of the outcome card's "This week" block. */
export interface WeekRow {
  readonly label: string;
  readonly text: string;
}

const FIGHT_WORD = {
  cleared: "all clear",
  contained: "contained",
  neededBackup: "backup arrived",
} as const;

/**
 * The "This week" block (outcomes design 4.2): how you lived, the odds and what happened, the
 * fight, and the score as Choices plus Outcome. Display only; the numbers come from `weekScore`.
 */
export function thisWeekRows(
  life: LifeState,
  result: CycleResult,
  odds: Pick<WeekOdds, "value" | "band">,
  landed: boolean,
  score: WeekScore,
): WeekRow[] {
  const { points, target } = life.goal;
  const happened = landed
    ? odds.band === "likely"
      ? "something came home"
      : "something came home anyway"
    : "nothing came home";
  let fight: string;
  if (result.kind === "quiet") fight = "just a virus, no fight";
  else {
    const { tissue, grade } = result.outcome;
    const word =
      result.battleKind === "skirmish"
        ? grade === "cleared"
          ? "all quiet"
          : "still stirring"
        : FIGHT_WORD[grade];
    fight = `${word}, tissue ${tissue.health} of ${tissue.max}`;
  }
  return [
    {
      label: "Lived",
      text: `${points} of ${target} points, ${points >= target ? "goal met" : "short of the goal"}`,
    },
    { label: "Odds", text: `${odds.value}: ${happened}` },
    { label: "Fight", text: fight },
    {
      label: "Score",
      text: `${score.total} = Choices ${score.choices.total} + Outcome ${score.outcome.total}`,
    },
  ];
}

/** The best-score lines; empty when nothing could be saved. */
export function bestLines(rec: RecordResult | null): string[] {
  if (!rec || !rec.stored || !rec.entry) return [];
  const lines: string[] = [];
  if (rec.newBestTotal) lines.push("New best on this summer!");
  else lines.push(`Best on this summer: ${rec.entry.total}`);
  if (rec.newBestChoices && rec.previous)
    lines.push("Your best choices yet on this summer.");
  return lines;
}

export function scoreCard(
  history: readonly CycleRecord[],
  cycles: number,
  totals: CampaignScore,
  rec: RecordResult | null,
): ScoreCardModel {
  return {
    headline: goalsHeadline(history.filter((h) => h.goalMet).length, cycles),
    weeks: history.map((h, i) => {
      const w = h.score;
      return {
        head: `Week ${i + 1}: ${w.total}`,
        odds: summerOddsRow(h),
        choices: `Choices ${w.choices.total}: ${choicesParts(w)}`,
        outcome: `Outcome ${w.outcome.total}: ${outcomeParts(w)}`,
      };
    }),
    total: `Total: Choices ${totals.choices} + Outcome ${totals.outcome} = ${totals.total}`,
    best: bestLines(rec),
    framing: SCORE_FRAMING,
  };
}
