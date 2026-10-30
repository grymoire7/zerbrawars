import { PARAMS } from "../params";
import type { PathogenKindId } from "../pathogens";
import type { Coord } from "../types";
import type { CardId, HandCardId } from "./types";

/** Words and structure; every number lives in PARAMS.life.cards. */
interface CardText {
  readonly label: string;
  /** Who asks, so the choice is about people. */
  readonly people: string;
  readonly blurb: string;
  /** The hand card this is a version of. */
  readonly base: HandCardId;
  /** The smarter version of a base card. */
  readonly smarter?: CardId;
  readonly kind: PathogenKindId;
  /** Runs overnight: evening slot only, never the last day, and the next morning's dose is away. */
  readonly overnight?: boolean;
}

const TEXT: Record<CardId, CardText> = {
  yard: {
    label: "Yard work with Maya",
    people: "Your sister Maya wants help clearing the yard before the party.",
    blurb: "Mulch, dead leaves and compost: mold spores in the air.",
    base: "yard",
    smarter: "yardIndoor",
    kind: "aspergillus",
  },
  yardIndoor: {
    label: "Indoor jobs for Maya",
    people: "Maya does the mulch; you set up inside and fire up the grill.",
    blurb: "Still helping, still hanging out, mostly away from the spores.",
    base: "yard",
    kind: "aspergillus",
  },
  lake: {
    label: "The lake with Jordan",
    people: "Jordan wants you at the lake, lagoon swim and all.",
    blurb: "The warm, still lagoon water carries bacteria.",
    base: "lake",
    smarter: "beach",
    kind: "strep",
  },
  beach: {
    label: "The beach, not the lagoon",
    people: "Same day with Jordan, but you swim off the open beach.",
    blurb: "Open, moving water brings far fewer bacteria.",
    base: "lake",
    kind: "strep",
  },
  band: {
    label: "Band practice",
    people: "Alex needs the whole band for the recording.",
    blurb: "Indoors with friends. Low odds of anything.",
    base: "band",
    kind: "strep",
  },
  sleepover: {
    label: "Sleepover at Sam's",
    people: "Sam's having everyone over for the night.",
    blurb:
      "Your pills are in the other bag. Pack them, or miss tomorrow's dose.",
    base: "sleepover",
    kind: "strep",
    overnight: true,
  },
};

export interface CardDef extends CardText {
  readonly id: CardId;
  readonly points: number;
  readonly energy: number;
  readonly exposure: {
    readonly kind: PathogenKindId;
    /** Odds the exposure lands when the card's day ends. */
    readonly chance: number;
    readonly size: number;
    readonly count: number;
    /** Preferred entry tiles on the battle slab. */
    readonly at: readonly Coord[];
  };
}

export const CARD_IDS = Object.keys(TEXT) as CardId[];

/** The four cards dealt each week (the same hand every week in the prototype). */
export const HAND: readonly HandCardId[] = [
  "yard",
  "lake",
  "band",
  "sleepover",
];

export function isCardId(id: string): id is CardId {
  return Object.hasOwn(TEXT, id);
}

export function cardDef(id: CardId): CardDef {
  const t = TEXT[id];
  const n = PARAMS.life.cards[id];
  return {
    id,
    ...t,
    points: n.points,
    energy: n.energy,
    exposure: {
      kind: t.kind,
      chance: n.chance,
      size: n.size,
      count: n.count,
      at: n.at,
    },
  };
}

/** The versions a hand card can be played as: itself first, then its smarter version. */
export function versionsOf(base: HandCardId): CardId[] {
  const s = TEXT[base].smarter;
  return s ? [base, s] : [base];
}

/** Energy a placement costs, the pills included when packed for an overnight card. */
export function placementCost(card: CardId, packPills: boolean): number {
  return (
    cardDef(card).energy +
    (packPills && TEXT[card].overnight ? PARAMS.life.packPillsEnergy : 0)
  );
}
