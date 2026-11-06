import {
  PATHOGEN_KINDS,
  type PathogenForm,
  type PathogenKindId,
} from "./pathogens";

/**
 * The one place that names organisms to the player. Every player-facing string that says what a
 * germ is (key, info cards, arrival marks, life-screen lines, outcome, battle log) goes through
 * here; src/organisms.test.ts fails if a pathogen word turns up in a string literal elsewhere.
 *
 * It lives under src/sim only because sim text (card blurbs, support errors) needs it too: it is
 * pure data and string helpers, with no DOM and no three.js.
 */

interface OrganismText {
  /** Proper name, shown wherever there is room. */
  readonly name: string;
  /** Full scientific name, for the sub line of an info card. */
  readonly scientific: string;
  /** Short form for tight spots (the stats row, the board pill). */
  readonly short: string;
  /** Plain description, after the name: "Streptococcus, a round bacterium with no shell". */
  readonly description: string;
}

const ORGANISMS: Record<PathogenKindId, OrganismText> = {
  strep: {
    name: "Streptococcus",
    scientific: "Streptococcus",
    short: "Strep",
    description: "a round bacterium with no shell",
  },
  staph: {
    name: "Staphylococcus",
    scientific: "Staphylococcus aureus",
    short: "Staph",
    description: "a round bacterium in a shell",
  },
  aspergillus: {
    name: "Aspergillus",
    scientific: "Aspergillus",
    short: "Aspergillus",
    description: "a mold in a shell, found in soil and compost",
  },
};

export const organismName = (kind: PathogenKindId) => ORGANISMS[kind].name;

export const organismScientific = (kind: PathogenKindId) =>
  ORGANISMS[kind].scientific;

export const organismShort = (kind: PathogenKindId) => ORGANISMS[kind].short;

export const organismDescription = (kind: PathogenKindId) =>
  ORGANISMS[kind].description;

/** "1 Staphylococcus", "2 Streptococcus": organism names do not take a plural s. */
export const organismCount = (kind: PathogenKindId, n: number) =>
  `${n} ${ORGANISMS[kind].name}`;

/** Short form with a count, for tight spots: "2 Staph". */
export const organismCountShort = (kind: PathogenKindId, n: number) =>
  `${n} ${ORGANISMS[kind].short}`;

/** The sub line of an info card: "Staphylococcus aureus, a round bacterium in a shell". */
export const organismSub = (kind: PathogenKindId) =>
  `${ORGANISMS[kind].scientific}, ${ORGANISMS[kind].description}`;

/** The key's tail, terse: "Staphylococcus aureus, a bacterium". */
export const organismKeyText = (kind: PathogenKindId) =>
  `${ORGANISMS[kind].scientific}, a ${formNoun(PATHOGEN_KINDS[kind].form)}`;

/** For screen readers: "Staphylococcus, a round bacterium in a shell". */
export const organismAria = (kind: PathogenKindId) =>
  `${ORGANISMS[kind].name}, ${ORGANISMS[kind].description}`;

/** A list of names: "Streptococcus", "Streptococcus and Staphylococcus", "A, B and C". */
export function organismList(kinds: readonly PathogenKindId[]): string {
  const names = kinds.map(organismName);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// Grouping words, for places that talk about a whole family rather than one organism.

/** "bacterium" or "mold" (plural "bacteria", "molds"). */
export function formNoun(form: PathogenForm, plural = false): string {
  if (form === "mold") return plural ? "molds" : "mold";
  return plural ? "bacteria" : "bacterium";
}

/** What an antibacterial or antifungal charge treats, as a plural: "bacteria" or "molds". */
export const chargeTargets = {
  antibacterial: formNoun("bacterium", true),
  antifungal: formNoun("mold", true),
} as const;
