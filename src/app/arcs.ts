import type { ScenarioName } from "../sim/scenarios";

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
  /** Arc 1: an intro card, part A, a story card, part B. Both parts use the tutorial seed. */
  | {
      readonly kind: "tutorial";
      readonly partA: ScenarioName;
      readonly partB: ScenarioName;
      /** The intro card: its title, the paragraphs after the arc `intro`, and its two buttons. */
      readonly introTitle: string;
      readonly introMore: readonly string[];
      readonly begin: string;
      readonly skip: string;
      /** Part B's outcome card text when it ends All clear, and when it ends Contained. */
      readonly endClear: string;
      readonly endHeld: string;
    }
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

/** In play order. */
export const ARCS: readonly ArcDef[] = [
  {
    id: "tutorial",
    number: 1,
    title: "First infection",
    blurb: "Two short fights, before and after a diagnosis.",
    intro:
      "Some people remember the time before they knew they had CGD. Some were too little to remember. Either way, it often goes something like this.",
    completion:
      "That is how it started. From here on, medicine is part of your routine, and the fights are yours to plan.",
    play: {
      kind: "tutorial",
      partA: "tutorial-a",
      partB: "tutorial-b",
      introTitle: "Before anyone knew",
      introMore: [
        "A germ got into your lungs, and your cells rushed in to deal with it.",
      ],
      begin: "Begin",
      skip: "Skip to after the diagnosis",
      endClear:
        "Same germs, different ending. CGD takes one tool away, not your whole defence, and your medicine helps fill the gap.",
      endHeld:
        "Not quite all clear, and that is fine. Your medicine gave your cells a real chance, and the doctor can help with the rest.",
    },
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
