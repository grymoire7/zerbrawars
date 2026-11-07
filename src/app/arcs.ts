import { DEFAULT_SCENARIO, type ScenarioName } from "../sim/scenarios";

/** Which form of CGD the player's character has. It picks per-character parameters, not mechanics. */
export type VariantId = "xl" | "ar";

export interface VariantDef {
  readonly id: VariantId;
  readonly label: string;
  readonly blurb: string;
}

export const VARIANTS: readonly VariantDef[] = [
  {
    id: "xl",
    label: "CGD, X-linked",
    blurb: "Passed down on the X chromosome.",
  },
  {
    id: "ar",
    label: "CGD, autosomal recessive",
    blurb: "Passed down when both parents carry the gene.",
  },
];

export type ArcId = "tutorial" | "summer";

/** What an arc plays: one battle from a scenario, or the two-week campaign. */
export type ArcPlay =
  | { readonly kind: "battle"; readonly scenario: ScenarioName }
  | { readonly kind: "campaign" };

/** An arc is data: the screens around it come from here, the play is one of two existing flows. */
export interface ArcDef {
  readonly id: ArcId;
  /** 1-based position, as ?arc=N names it. */
  readonly number: number;
  readonly title: string;
  /** One line for the picker. */
  readonly blurb: string;
  /** Shown before play. */
  readonly intro: string;
  /** Shown on the arc-complete screen. */
  readonly completion: string;
  readonly play: ArcPlay;
}

/** In play order. Arc 1 is a placeholder until the tutorial is built. */
export const ARCS: readonly ArcDef[] = [
  {
    id: "tutorial",
    number: 1,
    title: "First infection",
    blurb: "A short first fight, to learn the board.",
    intro:
      "Arc 1 is a placeholder until the tutorial is built. For now it is one short fight.",
    completion:
      "That was the first fight. The real tutorial will walk you through it step by step.",
    play: { kind: "battle", scenario: DEFAULT_SCENARIO },
  },
  {
    id: "summer",
    number: 2,
    title: "A first summer",
    blurb: "Two weeks of living, and the fights that come with them.",
    intro:
      "Two weeks of a summer: plan your days, look after yourself, and deal with what turns up.",
    completion: "That was your first summer.",
    play: { kind: "campaign" },
  },
];

export const arcById = (id: ArcId): ArcDef =>
  ARCS.find((a) => a.id === id) ?? ARCS[0]!;

export const variantById = (id: VariantId): VariantDef =>
  VARIANTS.find((v) => v.id === id) ?? VARIANTS[0]!;
