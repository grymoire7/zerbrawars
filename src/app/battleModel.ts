import { PARAMS } from "../sim/params";
import type { MedCharges } from "../sim/types";
import type { StatusCell, StatusModel } from "../ui/statusStrip";
import { chargesText, medDoses, medStateWord } from "./lifeModel";

// Pure builder for the battle screen's status strip (B1a design, section 2.3).

export interface BattleStatusInput {
  /** Tissue health now (live while a turn plays). */
  readonly tissue: number;
  /** Tissue the next inflammation tick will cost. */
  readonly damage: number;
  /** Medication level, 0..1. */
  readonly medLevel: number;
  readonly charges: MedCharges;
  /** The week's Choices so far, or null in a standalone battle (no Score cell). */
  readonly choices: number | null;
}

export function tissueState(tissue: number): string {
  if (tissue <= PARAMS.outcome.backupTissueHealth) return "backup coming";
  return tissue >= PARAMS.maxTissueHealth * 0.8 ? "healthy" : "strained";
}

export function inflammationState(damage: number): "calm" | "warm" | "hot" {
  return damage <= 0 ? "calm" : damage < 3 ? "warm" : "hot";
}

const chargeCount = (c: MedCharges) =>
  c.antibacterial + c.antifungal + c.strong;

export function battleStatusModel(i: BattleStatusInput): StatusModel {
  const max = PARAMS.maxTissueHealth;
  const tissue = Math.max(0, i.tissue);
  const loss = Math.min(tissue, Math.max(0, i.damage));
  const heat = inflammationState(i.damage);
  const window = PARAMS.life.meds.window;
  const doses = medDoses(i.medLevel);
  const n = chargeCount(i.charges);

  const cells: StatusCell[] = [
    {
      id: "tissue",
      label: "Tissue",
      value: `${tissue}/${max}`,
      state: tissueState(tissue),
      bar: {
        kind: "fill",
        solid: (tissue - loss) / max,
        ghost: tissue / max,
        notch: PARAMS.outcome.backupTissueHealth / max,
      },
      color: "tissue",
      explain: `Tissue health out of ${max}. Heat and loose germs wear it down. Each point kept adds ${PARAMS.score.perTissue} to Outcome. The notch marks where backup is called.`,
    },
    {
      id: "inflammation",
      label: "Inflammation",
      value: heat === "calm" ? "no loss next turn" : `-${i.damage} next turn`,
      state: heat,
      bar: {
        kind: "segments",
        count: 3,
        solid: Math.min(3, Math.max(0, i.damage)),
        ghost: Math.min(3, Math.max(0, i.damage)),
      },
      color: "heat",
      explain:
        "Heat from crowding, loads and germs. Hot tiles cost tissue every turn." +
        (i.damage > 0 ? ` Next turn it costs ${i.damage} tissue.` : ""),
    },
    {
      id: "medication",
      label: "Medication",
      value: `${doses}/${window} doses, ${n} ${n === 1 ? "charge" : "charges"}`,
      state: medStateWord(doses, window),
      bar: { kind: "segments", count: window, solid: doses, ghost: doses },
      color: "med",
      explain: `Your aura slows germs. Charges come from doses taken: ${chargesText(i.charges)}.`,
    },
  ];
  if (i.choices !== null) {
    cells.push({
      id: "score",
      label: "Score",
      value: `Choices ${i.choices}`,
      state: "Outcome next",
      bar: null,
      color: "goal",
      explain: "Your choices this week. Outcome is added when the fight ends.",
    });
  }
  return { cells };
}
