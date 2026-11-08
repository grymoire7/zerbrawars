import type { Campaign } from "../sim/campaign";
import { PARAMS } from "../sim/params";
import { listBest, type BestEntry } from "./bestScores";
import {
  ARCS,
  VARIANTS,
  arcById,
  variantById,
  type ArcDef,
  type ArcId,
  type VariantId,
} from "./arcs";
import type { ScreenRequest } from "./screen";
import { parseTutorialPart, type TutorialPart } from "./tutorialModel";

// The pure side of the title, the pickers and the arc-complete screen: what is offered, what each
// choice leads to, and the text. The screens in menuScreens.ts only draw it.

export const TITLE = "Zebra Wars";
export const TAGLINE = "Fight infections from the inside, one turn at a time.";
export const VARIANT_HEADING = "Choose your character";
export const WILSON = {
  label: "Wilson's disease",
  note: "A separate game, coming later",
};

export interface MenuChoice {
  readonly label: string;
  readonly sub: string;
  /** Absent when the choice is shown but cannot be picked. */
  readonly to?: ScreenRequest;
  /** Extra lines under the choice (best scores). */
  readonly lines: readonly string[];
}

export const variantChoices = (): MenuChoice[] =>
  VARIANTS.map((v) => ({
    label: v.label,
    sub: v.blurb,
    to: { mode: "arcs", variant: v.id },
    lines: [],
  }));

/** The saved bests for one arc and variant, best first, as short lines. */
export function bestsText(
  arc: ArcId,
  variant: VariantId,
  entries: readonly { id: string; entry: BestEntry }[] = listBest(variant),
  max = 3,
): string[] {
  const mine = entries.filter(({ id }) => id.split("|")[1] === arc);
  if (mine.length === 0) return [];
  return mine.slice(0, max).map(({ entry }) => {
    return `${entry.total} points (Choices ${entry.choices}, Outcome ${entry.outcome})`;
  });
}

const NO_BESTS = "No score yet. Finish the two weeks to set one.";

export function arcChoices(
  variant: VariantId,
  entries?: readonly { id: string; entry: BestEntry }[],
): MenuChoice[] {
  return ARCS.map((a) => {
    const bests =
      a.play.kind === "campaign" ? bestsText(a.id, variant, entries) : null;
    return {
      label: `Arc ${a.number}: ${a.title}`,
      sub: a.blurb,
      to: { mode: "arcPlay", arc: a.id, variant },
      lines:
        bests === null
          ? []
          : bests.length > 0
            ? ["Best scores", ...bests]
            : [NO_BESTS],
    };
  });
}

/** Where a held summer is, in plain words: the week and day, or what is waiting. */
export function heldLine(c: Campaign, variant: VariantId): string {
  const week = `Week ${c.cycle} of ${c.cycles}`;
  let where: string;
  if (c.mode === "life") {
    const day = Math.min(c.life.day + 1, PARAMS.life.days);
    where =
      c.life.day >= PARAMS.life.days
        ? `${week}, the end of the week`
        : `${week}, day ${day}`;
  } else if (c.mode === "battle") {
    where = `${week}, a fight is waiting`;
  } else {
    where = `${week}, after the week's fight`;
  }
  return `${where} · ${variantById(variant).label}`;
}

export const CONTINUE_LABEL = "Continue your summer";

/** The title's Continue item for a held summer; absent without one. */
export function continueChoice(
  held: { campaign: Campaign; variant: VariantId } | null,
): MenuChoice | null {
  if (!held) return null;
  return {
    label: CONTINUE_LABEL,
    sub: heldLine(held.campaign, held.variant),
    to: { mode: "continue" },
    lines: [],
  };
}

/**
 * What the arc picker lists: Continue first when a summer is held (the same item the title
 * offers), then the arcs.
 */
export function pickerChoices(
  variant: VariantId,
  held: { campaign: Campaign; variant: VariantId } | null,
  entries?: readonly { id: string; entry: BestEntry }[],
): MenuChoice[] {
  const cont = continueChoice(held);
  return [...(cont ? [cont] : []), ...arcChoices(variant, entries)];
}

/** Which screen picks a held summer up: the campaign's own mode decides. */
export function resumeTarget(
  c: Campaign,
): "life" | "battle" | "quiet" | "summary" {
  if (c.mode === "life") return "life";
  if (c.mode === "battle") return "battle";
  if (c.mode === "done") return "summary";
  return c.result?.kind === "quiet" ? "quiet" : "battle";
}

/** Starting a summer while one is held replaces it, so the picker asks first. */
export function needsReplaceConfirm(
  to: ScreenRequest | undefined,
  held: boolean,
): boolean {
  return (
    held && to?.mode === "arcPlay" && arcById(to.arc).play.kind === "campaign"
  );
}

export const REPLACE_CONFIRM = {
  title: "Start a new summer?",
  text: "Your current summer will be replaced.",
  keep: "Keep my summer",
  replace: "Start a new summer",
};

export interface CompleteButton {
  readonly label: string;
  readonly primary?: boolean;
  readonly to: ScreenRequest;
}

/**
 * How an arc ends, the same for every arc: Replay (the same game, with `seed` when it has one),
 * New game (arcs that play a seeded campaign), Choose another arc, Change character.
 */
export const completeButtons = (
  arc: ArcId,
  variant: VariantId,
  seed?: number,
  randomSeed: () => number = () => Math.floor(Math.random() * 1_000_000),
): CompleteButton[] => {
  // A tutorial arc leads straight into the next one, so that is its primary button.
  const next =
    arcById(arc).play.kind === "tutorial"
      ? ARCS.find((a) => a.number === arcById(arc).number + 1)
      : undefined;
  return [
    ...(next
      ? [
          {
            label: `Go on to Arc ${next.number}`,
            primary: true,
            to: { mode: "arcPlay", arc: next.id, variant },
          } as CompleteButton,
        ]
      : []),
    {
      label: "Replay",
      primary: !next,
      to:
        seed === undefined
          ? { mode: "arcPlay", arc, variant }
          : { mode: "arcPlay", arc, variant, seed },
    },
    ...(arcById(arc).play.kind === "campaign"
      ? [
          {
            label: "New game",
            to: { mode: "arcPlay", arc, variant, seed: randomSeed() },
          } as CompleteButton,
        ]
      : []),
    { label: "Choose another arc", to: { mode: "arcs", variant } },
    { label: "Change character", to: { mode: "title" } },
  ];
};

export const arcCompleteTitle = (a: ArcDef) =>
  `Arc ${a.number} complete: ${a.title}`;

export type StartChoice =
  | { readonly kind: "title" }
  | { readonly kind: "arcs"; readonly variant: VariantId }
  | {
      readonly kind: "arc";
      readonly arc: ArcId;
      readonly variant: VariantId;
      /** ?part=b (debug): start Arc 1 at part B. */
      readonly part?: TutorialPart;
    }
  | { readonly kind: "debug" };

const DEBUG_KEYS = [
  "mode",
  "seed",
  "reservoirs",
  "med",
  "goal",
  "scenario",
  "doctor",
  "residual",
];

/** A developer start: the URL carries a debug lever (?mode, ?seed, ?med and the rest). */
export const isDebugStart = (params: URLSearchParams): boolean =>
  DEBUG_KEYS.some((k) => params.has(k));

const parseVariant = (raw: string | null): VariantId | null =>
  raw === "xl" || raw === "ar" ? raw : null;

/**
 * Where the page starts. The old debug URLs (?mode, ?seed, reservoirs, med, goal and the loadout
 * levers) go straight in as before; ?arc=1|2 starts that arc; ?variant alone opens the picker;
 * a bare URL is the title.
 */
export function parseStart(params: URLSearchParams): StartChoice {
  const variant = parseVariant(params.get("variant"));
  const n = Number(params.get("arc"));
  const arc = ARCS.find((a) => a.number === n);
  if (arc) {
    const part =
      arc.play.kind === "tutorial" ? parseTutorialPart(params) : undefined;
    return {
      kind: "arc",
      arc: arc.id,
      variant: variant ?? "xl",
      ...(part ? { part } : {}),
    };
  }
  if (isDebugStart(params)) return { kind: "debug" };
  if (variant) return { kind: "arcs", variant };
  return { kind: "title" };
}
