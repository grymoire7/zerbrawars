import type { CampaignScore, WeekScore } from "../sim/score";
import type { ScoreCardModel } from "../ui/interlude";
import type { RecordResult } from "./bestScores";

// The campaign-complete score view (docs/specs/b1a-design.md 1.6). Plain and non-blaming:
// Choices is "what you chose", Outcome is "how it went"; nothing is subtracted or shamed.

export const SCORE_FRAMING =
  "Infections happen whatever you do. Choices is what you chose, and the part you control. Outcome is how it went, and includes the dice.";

export const choicesParts = (w: WeekScore) =>
  `living ${w.choices.living}, dodged ${w.choices.dodged}, meds ${w.choices.meds}, checked ${w.choices.checked}`;

export const outcomeParts = (w: WeekScore) =>
  `tissue ${w.outcome.tissue}, fight ${w.outcome.fight}, clear ${w.outcome.clear}`;

/** The one line on the week's outcome overlay. */
export const weekScoreLine = (w: WeekScore) =>
  `This week: ${w.total} (Choices ${w.choices.total} + Outcome ${w.outcome.total})`;

/** The best-score lines; empty when nothing could be saved. */
export function bestLines(rec: RecordResult | null): string[] {
  if (!rec || !rec.stored || !rec.entry) return [];
  const lines: string[] = [];
  if (rec.newBestTotal) lines.push("New best on this seed!");
  else lines.push(`Best on this seed: ${rec.entry.total}`);
  if (rec.newBestChoices && rec.previous)
    lines.push("Your best choices yet on this seed.");
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
