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
  /** Only on the last day of the week (with eveningOnly: that day's evening). */
  readonly lastDayOnly?: boolean;
  /** Runs late: its day's evening pills may slip (PARAMS.life.meds.slip.lateNight). */
  readonly lateNight?: boolean;
  /** The doctor visit: costs set by its timing (PARAMS.campaign.doctor), brings nothing in. */
  readonly doctor?: boolean;
}

const TEXT: Record<CardId, CardText> = {
  yard: {
    label: "Yard party with Maya",
    people: "Your sister Maya wants help clearing the yard before the party.",
    blurb: `Mulch, dead leaves and compost: ${organismName("aspergillus")} spores in the air.`,
    base: "yard",
    smarter: "yardIndoor",
    kinds: ["aspergillus"],
  },
  yardIndoor: {
    label: "Indoor jobs for you",
    people: "Maya does the mulch; you set up inside and fire up the grill.",
    blurb: "Still helping, still hanging out, mostly away from the spores.",
    base: "yard",
    kinds: ["aspergillus"],
  },
  lake: {
    label: "The lake with Jordan",
    people: "Jordan invites you to the lake, lagoon swim and all.",
    blurb: `The warm, still lagoon carries ${organismList(["strep", "staph"])}, some of them the kind your cells can only hold.`,
    base: "lake",
    smarter: "beach",
    kinds: ["strep", "staph"],
  },
  beach: {
    label: "Open beach only, not the lagoon",
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
      "The pills might end up in the other bag, and then tomorrow's dose is missed.",
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
    blurb: "Fewer games, fewer points, but pills are taken.",
    base: "game",
    kinds: ["strep"],
    eveningOnly: true,
  },
  wood: {
    label: "Green woodworking with Dad",
    people: "Dad is cutting fresh green wood and wants your help in the shop.",
    blurb: `Damp sawdust and bark hold ${organismName("aspergillus")} spores, and sanding and sawing throw them into the air.`,
    base: "wood",
    smarter: "woodDry",
    kinds: ["aspergillus"],
  },
  woodDry: {
    label: "Dry wood, outside",
    people: "Same project with Dad, but with dry boards, out in the open air.",
    blurb: "Dry wood in fresh air gives the spores far less to grow on.",
    base: "wood",
    kinds: ["aspergillus"],
  },
  crawl: {
    label: "Crawlspace for the ball",
    people:
      "A friend's soccer ball rolled under the house, and they ask you to crawl in after it.",
    blurb: `The crawlspace is dark, damp and dusty, and ${organismName("aspergillus")} spores settle there.`,
    base: "crawl",
    smarter: "crawlRake",
    kinds: ["aspergillus"],
  },
  crawlRake: {
    label: "Hook the ball out with a rake",
    people: "You still get the ball back for your friend, without going in.",
    blurb: "Staying out of the crawlspace keeps you out of the dusty air.",
    base: "crawl",
    kinds: ["aspergillus"],
  },
  flytrap: {
    label: "Keep the flytrap in your room",
    people:
      "Someone gave you a Venus flytrap as a gift, and it would look great on your desk.",
    blurb: `It lives in damp potting soil and moss, and ${organismName("aspergillus")} grows there. Indoor plants in damp soil are not recommended for people with your disease.`,
    base: "flytrap",
    smarter: "flytrapGarage",
    kinds: ["aspergillus"],
  },
  flytrapGarage: {
    label: "Flytrap in the garage",
    people:
      "You keep the gift, and the person who gave it will be glad to see it doing well.",
    blurb:
      "The garage is out of the living space and beside Dad's wood pile, which you should stay away from anyway, so most of the risk fades.",
    base: "flytrap",
    kinds: ["aspergillus"],
  },
  trip: {
    label: "Leave for Vietnam",
    people:
      "The senior class is going to Vietnam, and your friends want you on the trip.",
    blurb: `Warm soil and muddy water on the way and in the first days can carry ${organismName("burkholderia")}.`,
    base: "trip",
    smarter: "tripPlan",
    kinds: ["burkholderia"],
    eveningOnly: true,
    lastDayOnly: true,
  },
  tripPlan: {
    label: "Leave for Vietnam, with a travel plan",
    people: "Same class trip, but you and your care team plan it together.",
    blurb:
      "Closed shoes, bottled water and no wading through mud keep you away from warm soil and muddy water.",
    base: "trip",
    kinds: ["burkholderia"],
    eveningOnly: true,
    lastDayOnly: true,
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

/** Every non-doctor hand card, across all weeks. */
export const POOL: readonly HandCardId[] = [
  "yard",
  "lake",
  "band",
  "sleepover",
  "game",
  "wood",
  "crawl",
  "flytrap",
  "trip",
];

/** The five cards dealt in each week; later weeks reuse the last entry. */
const HANDS: Record<1 | 2, readonly HandCardId[]> = {
  1: ["yard", "lake", "band", "sleepover", "game"],
  2: ["band", "wood", "crawl", "flytrap", "trip"],
};

/** The five cards dealt in `week` (week 1's before week 1, week 2's from week 2 on); see DOCTOR_CARD. */
export function handFor(week: number): readonly HandCardId[] {
  return week <= 1 ? HANDS[1] : HANDS[2];
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

/** Energy a placement costs. The doctor's cost depends on its timing; see doctorCost in body.ts. */
export function placementCost(card: CardId): number {
  return cardDef(card).energy;
}
