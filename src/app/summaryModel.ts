import type { CycleResult } from "../sim/campaign";
import type { LifeState } from "../sim/life/types";
import type { CampaignScore, WeekScore } from "../sim/score";
import type { ScoreCardModel } from "../ui/interlude";
import type { RecordResult } from "./bestScores";
import type { WeekOdds } from "./lifeModel";

// The campaign-complete score view (docs/specs/b1a-design.md 1.6). Plain and non-blaming:
// Choices is "what you chose", Outcome is "how it went"; nothing is subtracted or shamed.

export const SCORE_FRAMING =
  "Infections happen whatever you do. Choices is what you chose, and the part you control. Outcome is how it went, and includes the dice.";

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
  weeks: readonly WeekScore[],
  totals: CampaignScore,
  rec: RecordResult | null,
): ScoreCardModel {
  return {
    weeks: weeks.map((w, i) => ({
      head: `Week ${i + 1}: ${w.total}`,
      choices: `Choices ${w.choices.total}: ${choicesParts(w)}`,
      outcome: `Outcome ${w.outcome.total}: ${outcomeParts(w)}`,
    })),
    total: `Total: Choices ${totals.choices} + Outcome ${totals.outcome} = ${totals.total}`,
    best: bestLines(rec),
    framing: SCORE_FRAMING,
  };
}
