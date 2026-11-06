/**
 * Leaky: catalase-negative, leaves peroxide a CGD cell can use, so engulfing kills it.
 * Sealed: catalase-positive, engulfing only contains it.
 */
export type Wall = "leaky" | "sealed";

/**
 * Growth form drives the silhouette. It is kept separate from `wall` on purpose:
 * Staph aureus, Serratia and Burkholderia are sealed bacteria, so "round" must not mean "killable".
 */
export type PathogenForm = "bacterium" | "mold";

export interface PathogenKindDef {
  readonly wall: Wall;
  readonly form: PathogenForm;
  readonly canSpore: boolean;
}

export const PATHOGEN_KINDS = {
  strep: {
    wall: "leaky",
    form: "bacterium",
    canSpore: false,
  },
  aspergillus: {
    wall: "sealed",
    form: "mold",
    canSpore: true,
  },
  // A sealed bacterium: round like strep, but with the shell rim, so engulfing only contains it.
  staph: {
    wall: "sealed",
    form: "bacterium",
    canSpore: false,
  },
} as const satisfies Record<string, PathogenKindDef>;

export type PathogenKindId = keyof typeof PATHOGEN_KINDS;

export function isPathogenKindId(kind: string): kind is PathogenKindId {
  return Object.hasOwn(PATHOGEN_KINDS, kind);
}

export function pathogenKind(kind: PathogenKindId): PathogenKindDef {
  return PATHOGEN_KINDS[kind];
}

export function wallOf(p: { readonly kind: PathogenKindId }): Wall {
  return PATHOGEN_KINDS[p.kind].wall;
}
