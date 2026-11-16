import { rngFromSeed, rngNext } from "../rng";
import { cardDef, DOCTOR_CARD, handFor } from "./cards";
import {
  advanceDay,
  createLife,
  placeCard,
  placementProblems,
  skipMeds,
  todayDose,
  weekOver,
} from "./calendar";
import { plannedChoices } from "../score";
import type { CardId, HandCardId, LifeState } from "./types";

// Headless life-phase players for balance checks. The bots that name their versions play one fixed
// calendar shape, which fits a first week's energy:
//   day 1: yard, sleepover   day 2: rest, lake   day 3: band, game night
// The full hand costs more than a week's energy, so cards are placed in the bot's drop order (first
// = most wanted) and any that no longer fit stay home. The planner picks its own shape. The shape
// only fits the week-1 hand: with any other hand these bots play the best plan from the versions
// they name (bestPlacements with "risky" or "smarter").

/** Where each hand card sits in the fixed calendar shape. */
export const SLOTS: Partial<
  Record<Exclude<HandCardId, "doctor">, { day: number; slot: number }>
> = {
  yard: { day: 0, slot: 0 },
  sleepover: { day: 0, slot: 1 },
  lake: { day: 1, slot: 1 },
  game: { day: 2, slot: 1 },
  band: { day: 2, slot: 0 },
};

/** A card in a slot, for plans that choose their own calendar. */
export interface Placement {
  readonly card: CardId;
  readonly day: number;
  readonly slot: number;
}

type Base = Exclude<HandCardId, "doctor">;

/** What the naive careful player keeps first: the lagoon swap, the yard, the sleepover, then game night, then band. */
const SMART_ORDER: readonly Base[] = [
  "lake",
  "yard",
  "sleepover",
  "game",
  "band",
];
/** What the thrill-seeker keeps first: the biggest points, band last. */
const RISKY_ORDER: readonly Base[] = [
  "lake",
  "yard",
  "game",
  "sleepover",
  "band",
];

export interface WeekPlan {
  /** The version to play per hand card; missing = leave the slot as rest. */
  readonly cards: Partial<Record<HandCardId, CardId>>;
  readonly skipMeds: boolean;
  /** Which card to place first, and so the last to be dropped when energy runs out (default: the smart order). */
  readonly order?: readonly HandCardId[];
  /** An explicit calendar (the planner's); replaces `cards`, `order` and the fixed shape. */
  readonly placements?: readonly Placement[];
}

/** A strategy picks a week plan; `roll` gives seeded floats, `life` the fresh week (the planner reads it). */
export type LifeBot = (roll: () => number, life?: LifeState) => WeekPlan;

const RISKY = {
  yard: "yard",
  lake: "lake",
  band: "band",
  sleepover: "sleepover",
  game: "game",
} as const;
const SMARTER = {
  ...RISKY,
  yard: "yardIndoor",
  lake: "beach",
  game: "gameEarly",
} as const;

/** Every placement, in order, that fits `life`: the cards of `plan` in its drop order. */
export function planPlacements(plan: WeekPlan): readonly Placement[] {
  if (plan.placements) return plan.placements;
  const out: Placement[] = [];
  for (const base of (plan.order ?? SMART_ORDER) as readonly Base[]) {
    const card = plan.cards[base];
    const at = SLOTS[base];
    if (!card || !at) continue;
    const { day, slot } = at;
    out.push({ card, day, slot });
  }
  return out;
}

/** Places what fits, in order; the rest stay home. */
export function placeFitting(
  life: LifeState,
  placements: readonly Placement[],
): LifeState {
  for (const { card, day, slot } of placements)
    if (placementProblems(life, day, slot, card).length === 0)
      life = placeCard(life, day, slot, card).state;
  return life;
}

const bestCache = new Map<string, readonly Placement[]>();

/** Which versions a plan search may use: both, or only the risky or the smarter one. */
type Versions = "any" | "risky" | "smarter";

/**
 * The legal plan with the highest planned Choices (ties: the lowest total landing chance), found by
 * trying every card version in every slot. `versions` limits the search to the risky or the
 * smarter version of each card ("any" tries both), or picks per card (unnamed cards: both). Memoized by what the search reads
 * (versions, hand, energy, doses), since the answer does not depend on the seed.
 */
export function bestPlacements(
  life: LifeState,
  versions: Versions | Partial<Record<HandCardId, "risky" | "smarter">> = "any",
): readonly Placement[] {
  const key = JSON.stringify([
    versions,
    life.hand,
    life.energy,
    life.day,
    life.doses,
  ]);
  const hit = bestCache.get(key);
  if (hit) return hit;
  const bases = life.hand.filter((c) => c !== DOCTOR_CARD);
  let best: readonly Placement[] = [];
  let bestKey: [number, number] = [-1, 0];
  const walk = (i: number, at: LifeState, chosen: Placement[]) => {
    if (i === bases.length) {
      const total = plannedChoices(at).total;
      const risk = chosen.reduce(
        (n, p) => n + cardDef(p.card).exposure.chance,
        0,
      );
      if (total > bestKey[0] || (total === bestKey[0] && risk < bestKey[1])) {
        bestKey = [total, risk];
        best = chosen;
      }
      return;
    }
    walk(i + 1, at, chosen);
    const base = bases[i];
    const smarter = cardDef(base).smarter;
    const pick =
      typeof versions === "string" ? versions : (versions[base] ?? "any");
    const cards: CardId[] =
      pick === "risky"
        ? [base]
        : pick === "smarter"
          ? [smarter ?? base]
          : smarter
            ? [base, smarter]
            : [base];
    for (const card of cards)
      for (let day = at.day; day < at.plan.length; day++)
        for (let slot = 0; slot < at.plan[day].length; slot++) {
          if (placementProblems(at, day, slot, card).length > 0) continue;
          const next = placeCard(at, day, slot, card).state;
          walk(i + 1, next, [...chosen, { card, day, slot }]);
        }
  };
  walk(0, life, []);
  bestCache.set(key, best);
  return best;
}

/** True when `life` holds the week-1 hand the fixed shape was built for (a doctor aside). */
function fixedShapeFits(life: LifeState | undefined): boolean {
  if (!life) return true;
  const bases: readonly HandCardId[] = life.hand.filter(
    (c) => c !== DOCTOR_CARD,
  );
  const week1 = handFor(1);
  return bases.length === week1.length && week1.every((c) => bases.includes(c));
}

/** A fixed-shape bot for the week-1 hand; the best plan from `versions` for any other hand. */
const shaped =
  (
    versions: "risky" | "smarter",
    plan: (roll: () => number) => WeekPlan,
  ): LifeBot =>
  (roll, life) => {
    if (!life || fixedShapeFits(life)) return plan(roll);
    return {
      cards: {},
      skipMeds: plan(roll).skipMeds,
      placements: bestPlacements(life, versions),
    };
  };

export const LIFE_BOTS: Record<string, LifeBot> = {
  /** Rests every slot. */
  home: () => ({ cards: {}, skipMeds: false }),
  /** Only the safe card. */
  bandOnly: () => ({
    cards: { band: "band" },
    skipMeds: false,
  }),
  /** Every card in its risky version (game night at Alex's included). */
  risky: shaped("risky", () => ({
    cards: RISKY,
    skipMeds: false,
    order: RISKY_ORDER,
  })),
  /**
   * The thoughtful player: with the week in view it plays the best plan by the score's own forecast
   * (at goal 13 that takes one risky card, since the all-smarter week scores 12). Without a week it
   * falls back to every card in its smarter version.
   */
  smarter: (_roll, life) =>
    life
      ? {
          cards: {},
          skipMeds: false,
          placements: bestPlacements(life),
        }
      : { cards: SMARTER, skipMeds: false },
  /**
   * A coin flip per card version. Drops in the smart order. With another hand, the best plan
   * from the flipped versions.
   */
  mixed: (roll, life) => {
    if (life && !fixedShapeFits(life)) {
      const versions: Partial<Record<HandCardId, "risky" | "smarter">> = {};
      for (const c of life.hand)
        if (c !== DOCTOR_CARD) versions[c] = roll() < 0.5 ? "risky" : "smarter";
      return {
        cards: {},
        skipMeds: false,
        placements: bestPlacements(life, versions),
      };
    }
    const cards = {
      yard: roll() < 0.5 ? "yard" : "yardIndoor",
      lake: roll() < 0.5 ? "lake" : "beach",
      band: "band",
      sleepover: "sleepover",
      game: roll() < 0.5 ? "game" : "gameEarly",
    } as const;
    return { cards, skipMeds: false };
  },
  /**
   * The fixed shape with smarter versions, but the sleepover pills stay home and game night runs
   * late: the routine breaks. (Unlike the thoughtful player it reaches the goal through the late
   * game night, not through a plan.)
   */
  forgetful: shaped("smarter", () => ({
    cards: { ...SMARTER, game: "game" },
    skipMeds: false,
  })),
  /** The reference best: the legal plan with the highest planned Choices. */
  planner: (_roll, life) => {
    if (!life) throw new Error("the planner needs the week's life state");
    return {
      cards: {},
      skipMeds: false,
      placements: bestPlacements(life),
    };
  },
  /** Smarter cards but skips every dose ("I feel fine"): a test bot that models misses with skipMeds. */
  smarterSkipMeds: shaped("smarter", () => ({
    cards: SMARTER,
    skipMeds: true,
  })),
  /** Risky cards and skips every dose. */
  riskySkipMeds: shaped("risky", () => ({
    cards: RISKY,
    skipMeds: true,
    order: RISKY_ORDER,
  })),
};

/** Plays a whole week (week 1 unless given) from a fresh life with `bot`. */
export function playWeek(bot: LifeBot, seed: number, week = 1): LifeState {
  let rng = rngFromSeed(seed * 31 + 7);
  const roll = () => {
    const r = rngNext(rng);
    rng = r.rng;
    return r.value;
  };
  let life = createLife({ seed, week });
  const plan = bot(roll, life);
  life = placeFitting(life, planPlacements(plan));
  while (!weekOver(life)) {
    if (plan.skipMeds && todayDose(life)?.cause !== "friction") {
      life = skipMeds(life).state;
    }
    life = advanceDay(life).state;
  }
  return life;
}
