import { PARAMS } from "../params";
import { formNoun, organismList, organismName } from "../organisms";
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
  /** What it brings: pathogen i is kinds[i % kinds.length]. Empty for the doctor. */
  readonly kinds: readonly PathogenKindId[];
  /** Runs overnight: evening slot only, never the last day, and the next morning's dose is away. */
  readonly overnight?: boolean;
  /** Evening slot only (nothing keeps the day free for it). */
  readonly eveningOnly?: boolean;
  /** Runs late: its day's evening pills may slip (PARAMS.life.meds.slip.lateNight). */
  readonly lateNight?: boolean;
  /** The doctor visit: costs set by its timing (PARAMS.campaign.doctor), brings nothing in. */
  readonly doctor?: boolean;
}

const TEXT: Record<CardId, CardText> = {
  yard: {
    label: "Yard work with Maya",
    people: "Your sister Maya wants help clearing the yard before the party.",
    blurb: `Mulch, dead leaves and compost: ${organismName("aspergillus")} spores in the air.`,
    base: "yard",
    smarter: "yardIndoor",
    kinds: ["aspergillus"],
  },
  yardIndoor: {
    label: "Indoor jobs for Maya",
    people: "Maya does the mulch; you set up inside and fire up the grill.",
    blurb: "Still helping, still hanging out, mostly away from the spores.",
    base: "yard",
    kinds: ["aspergillus"],
  },
  lake: {
    label: "The lake with Jordan",
    people: "Jordan wants you at the lake, lagoon swim and all.",
    blurb: `The warm, still lagoon carries ${organismList(["strep", "staph"])}, some of them the kind your cells can only hold.`,
    base: "lake",
    smarter: "beach",
    kinds: ["strep", "staph"],
  },
  beach: {
    label: "The beach, not the lagoon",
    people: "Same day with Jordan, but you swim off the open beach.",
    blurb: `Open, moving water brings far fewer ${formNoun("bacterium", true)}.`,
    base: "lake",
    kinds: ["strep"],
  },
  band: {
    label: "Band practice",
    people: "Alex needs the whole band for the recording.",
    blurb: "Indoors with friends. Low odds of anything.",
    base: "band",
    kinds: ["strep"],
  },
  sleepover: {
    label: "Sleepover at Sam's",
    people: "Sam's having everyone over for the night.",
    blurb:
      "Your pills are in the other bag. Pack them, or miss tomorrow's dose.",
    base: "sleepover",
    kinds: ["strep"],
    overnight: true,
  },
  game: {
    label: "Game night at Alex's",
    people: "Alex is hosting board games and pizza, and it always runs late.",
    blurb:
      "Crowded room, shared snacks. Past midnight the evening pills are easy to lose track of.",
    base: "game",
    smarter: "gameEarly",
    kinds: ["strep"],
    eveningOnly: true,
    lateNight: true,
  },
  gameEarly: {
    label: "Game night, home by 11",
    people: "Same crowd at Alex's, but you head out in time for your pills.",
    blurb: "Fewer rounds, fewer points, and the routine holds.",
    base: "game",
    kinds: ["strep"],
    eveningOnly: true,
  },
  doctor: {
    label: "See the doctor",
    people: "Your care team can fit you in today.",
    blurb:
      "Imaging shows what is hiding, and you leave with strong backup for the next fight.",
    base: "doctor",
    kinds: [],
    doctor: true,
  },
};

export interface CardDef extends CardText {
  readonly id: CardId;
  readonly points: number;
  readonly energy: number;
  readonly exposure: {
    /** The main kind (kinds[0]); strep for the doctor, which brings nothing. */
    readonly kind: PathogenKindId;
    readonly kinds: readonly PathogenKindId[];
    /** Odds the exposure lands when the card's day ends. */
    readonly chance: number;
    readonly size: number;
    readonly count: number;
    /** Preferred entry tiles on the battle slab. */
    readonly at: readonly Coord[];
  };
}

export const CARD_IDS = Object.keys(TEXT) as CardId[];

/** The kind of the i-th pathogen a card brings. */
export function exposureKind(card: CardId, i: number): PathogenKindId {
  const kinds = TEXT[card].kinds;
  return kinds[i % kinds.length];
}

const HAND: readonly HandCardId[] = [
  "yard",
  "lake",
  "band",
  "sleepover",
  "game",
];

/** The five cards dealt in `week` (the same hand every week until week 2 gets its own); see DOCTOR_CARD. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- week 2 differs in slice 5
export function handFor(_week: number): readonly HandCardId[] {
  return HAND;
}

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
      kind: t.kinds[0] ?? "strep",
      kinds: t.kinds,
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

export const DOCTOR_CARD = "doctor" satisfies HandCardId;

/**
 * Energy a placement costs, the pills included when packed for an overnight card. The doctor's
 * cost depends on its timing; see doctorCost in body.ts.
 */
export function placementCost(card: CardId, packPills: boolean): number {
  return (
    cardDef(card).energy +
    (packPills && TEXT[card].overnight ? PARAMS.life.packPillsEnergy : 0)
  );
}
