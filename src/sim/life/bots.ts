import { rngFromSeed, rngNext } from "../rng";
import { cardDef, DOCTOR_CARD } from "./cards";
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
// calendar shape, which fits a first week's energy with the pills packed:
//   day 1: yard, sleepover   day 2: rest, lake   day 3: band, game night
// The full hand costs more than a week's energy, so cards are placed in the bot's drop order (first
// = most wanted) and any that no longer fit stay home. The planner picks its own shape.

/** Where each hand card sits in the fixed calendar shape. */
export const SLOTS: Record<
  Exclude<HandCardId, "doctor">,
  { day: number; slot: number }
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
  readonly packPills: boolean;
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
  readonly packPills: boolean;
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
    if (!card || !(base in SLOTS)) continue;
    const { day, slot } = SLOTS[base];
    out.push({ card, day, slot, packPills: plan.packPills });
  }
  return out;
}

/** Places what fits, in order; the rest stay home. */
export function placeFitting(
  life: LifeState,
  placements: readonly Placement[],
): LifeState {
  for (const { card, day, slot, packPills } of placements)
    if (placementProblems(life, day, slot, card, packPills).length === 0)
      life = placeCard(life, day, slot, card, packPills).state;
  return life;
}

const bestCache = new Map<string, readonly Placement[]>();

/**
 * The legal plan with the highest planned Choices (ties: the lowest total landing chance), found by
 * trying every card version in every slot, pills packed or not. Memoized by what the search reads
 * (hand, energy, doses), since the answer does not depend on the seed.
 */
export function bestPlacements(life: LifeState): readonly Placement[] {
  const key = JSON.stringify([life.hand, life.energy, life.day, life.doses]);
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
    const versions: CardId[] = [base];
    const smarter = cardDef(base).smarter;
    if (smarter) versions.push(smarter);
    for (const card of versions)
      for (let day = at.day; day < at.plan.length; day++)
        for (let slot = 0; slot < at.plan[day].length; slot++)
          for (const packPills of cardDef(card).overnight
            ? [true, false]
            : [false]) {
            if (placementProblems(at, day, slot, card, packPills).length > 0)
              continue;
            const next = placeCard(at, day, slot, card, packPills).state;
            walk(i + 1, next, [...chosen, { card, day, slot, packPills }]);
          }
  };
  walk(0, life, []);
  bestCache.set(key, best);
  return best;
}

export const LIFE_BOTS: Record<string, LifeBot> = {
  /** Rests every slot. */
  home: () => ({ cards: {}, packPills: false, skipMeds: false }),
  /** Only the safe card. */
  bandOnly: () => ({
    cards: { band: "band" },
    packPills: false,
    skipMeds: false,
  }),
  /** Every card in its risky version (game night at Alex's included), pills packed. */
  risky: () => ({
    cards: RISKY,
    packPills: true,
    skipMeds: false,
    order: RISKY_ORDER,
  }),
  /** Every card in its smarter version, pills packed: the third option. */
  smarter: () => ({ cards: SMARTER, packPills: true, skipMeds: false }),
  /** A coin flip per card version; the pills are packed four weeks in five. Drops in the smart order. */
  mixed: (roll) => {
    const cards = {
      yard: roll() < 0.5 ? "yard" : "yardIndoor",
      lake: roll() < 0.5 ? "lake" : "beach",
      band: "band",
      sleepover: "sleepover",
      game: roll() < 0.5 ? "game" : "gameEarly",
    } as const;
    const packPills = roll() < 0.8;
    return { cards, packPills, skipMeds: false };
  },
  /** Risky versions, the pills left at home: misses come from the sleepover and the late night. */
  careless: () => ({
    cards: RISKY,
    packPills: false,
    skipMeds: false,
    order: RISKY_ORDER,
  }),
  /** Smarter versions, but the sleepover pills stay home and game night runs late: the routine breaks. */
  forgetful: () => ({
    cards: { ...SMARTER, game: "game" },
    packPills: false,
    skipMeds: false,
  }),
  /** The reference best: the legal plan with the highest planned Choices. */
  planner: (_roll, life) => {
    if (!life) throw new Error("the planner needs the week's life state");
    return {
      cards: {},
      packPills: false,
      skipMeds: false,
      placements: bestPlacements(life),
    };
  },
  /** Smarter, but forgets the pills: the friction event costs one dose. */
  smarterNoPack: () => ({ cards: SMARTER, packPills: false, skipMeds: false }),
  /** Risky and forgets the pills. */
  riskyNoPack: () => ({
    cards: RISKY,
    packPills: false,
    skipMeds: false,
    order: RISKY_ORDER,
  }),
  /** Smarter cards but skips every dose ("I feel fine"): a test bot that models misses with skipMeds. */
  smarterSkipMeds: () => ({ cards: SMARTER, packPills: true, skipMeds: true }),
  /** Risky cards and skips every dose. */
  riskySkipMeds: () => ({
    cards: RISKY,
    packPills: true,
    skipMeds: true,
    order: RISKY_ORDER,
  }),
};

/** Plays a whole week from a fresh life with `bot`. */
export function playWeek(bot: LifeBot, seed: number): LifeState {
  let rng = rngFromSeed(seed * 31 + 7);
  const roll = () => {
    const r = rngNext(rng);
    rng = r.rng;
    return r.value;
  };
  let life = createLife({ seed });
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
