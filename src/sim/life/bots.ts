import { rngFromSeed, rngNext } from "../rng";
import {
  advanceDay,
  createLife,
  placeCard,
  placementProblems,
  skipMeds,
  todayDose,
  weekOver,
} from "./calendar";
import type { CardId, HandCardId, LifeState } from "./types";

// Headless life-phase players for balance checks. Each plays one fixed calendar shape, which fits
// a first week's energy with the pills packed:
//   day 1: yard, sleepover   day 2: rest, lake   day 3: band, game night
// The full hand costs more than a week's energy, so cards are placed in this order and any that
// no longer fit stay home: game night, then band, are dropped first.

const LAYOUT: readonly { base: HandCardId; day: number; slot: number }[] = [
  { base: "yard", day: 0, slot: 0 },
  { base: "sleepover", day: 0, slot: 1 },
  { base: "lake", day: 1, slot: 1 },
  { base: "game", day: 2, slot: 1 },
  { base: "band", day: 2, slot: 0 },
];

export interface WeekPlan {
  /** The version to play per hand card; missing = leave the slot as rest. */
  readonly cards: Partial<Record<HandCardId, CardId>>;
  readonly packPills: boolean;
  readonly skipMeds: boolean;
}

/** A strategy picks a week plan; `roll` gives seeded floats for the mixed one. */
export type LifeBot = (roll: () => number) => WeekPlan;

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
  risky: () => ({ cards: RISKY, packPills: true, skipMeds: false }),
  /** Every card in its smarter version, pills packed: the third option. */
  smarter: () => ({ cards: SMARTER, packPills: true, skipMeds: false }),
  /** A coin flip per card version and for the pills. */
  mixed: (roll) => ({
    cards: {
      yard: roll() < 0.5 ? "yard" : "yardIndoor",
      lake: roll() < 0.5 ? "lake" : "beach",
      band: "band",
      sleepover: "sleepover",
      game: roll() < 0.5 ? "game" : "gameEarly",
    },
    packPills: roll() < 0.5,
    skipMeds: false,
  }),
  /** Smarter, but forgets the pills: the friction event costs one dose. */
  smarterNoPack: () => ({ cards: SMARTER, packPills: false, skipMeds: false }),
  /** Risky and forgets the pills. */
  riskyNoPack: () => ({ cards: RISKY, packPills: false, skipMeds: false }),
  /** Smarter cards but skips every dose ("I feel fine"). */
  smarterSkipMeds: () => ({ cards: SMARTER, packPills: true, skipMeds: true }),
  /** Risky cards and skips every dose. */
  riskySkipMeds: () => ({ cards: RISKY, packPills: true, skipMeds: true }),
};

/** Plays a whole week from a fresh life with `bot`. */
export function playWeek(bot: LifeBot, seed: number): LifeState {
  let rng = rngFromSeed(seed * 31 + 7);
  const roll = () => {
    const r = rngNext(rng);
    rng = r.rng;
    return r.value;
  };
  const plan = bot(roll);
  let life = createLife({ seed });
  for (const { base, day, slot } of LAYOUT) {
    const card = plan.cards[base];
    if (
      card &&
      placementProblems(life, day, slot, card, plan.packPills).length === 0
    )
      life = placeCard(life, day, slot, card, plan.packPills).state;
  }
  while (!weekOver(life)) {
    if (plan.skipMeds && todayDose(life)?.cause !== "friction") {
      life = skipMeds(life).state;
    }
    life = advanceDay(life).state;
  }
  return life;
}
