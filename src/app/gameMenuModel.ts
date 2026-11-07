import { arcById, variantById, type ArcId, type VariantId } from "./arcs";

/** What the in-game menu says about where the player is. `week` is absent in a single-fight arc. */
export interface WhereInput {
  readonly arc: ArcId;
  readonly variant: VariantId;
  readonly week?: { readonly cycle: number; readonly cycles: number };
}

/** The two lines under the menu title; the first also describes the dialog to a screen reader. */
export function whereLines(w: WhereInput): { line: string; sub: string } {
  const title = arcById(w.arc).title;
  return {
    line: w.week
      ? `${title} · week ${w.week.cycle} of ${w.week.cycles}`
      : title,
    sub: variantById(w.variant).label,
  };
}

/** The question before leaving (N2 drops it once Continue holds the run). */
export function leaveQuestion(arc: ArcId): string {
  const what = arcById(arc).play.kind === "campaign" ? "summer" : "fight";
  return `Head back to the title? This ${what} will end here.`;
}

/** What Escape does on a play screen. `pick`: a selection or pending choice that Escape cancels first. */
export type EscapeAction = "closeMenu" | "cancelPick" | "openMenu" | "none";

export function escapeAction(s: {
  readonly menuOpen: boolean;
  /** Help, a probe or an outcome card is open: they own Escape. */
  readonly otherOpen: boolean;
  readonly pick: boolean;
}): EscapeAction {
  if (s.menuOpen) return "closeMenu";
  if (s.otherOpen) return "none";
  return s.pick ? "cancelPick" : "openMenu";
}

/** Where Tab goes inside a dialog of `count` controls: wraps at both ends. */
export function trapIndex(
  current: number,
  count: number,
  backwards: boolean,
): number {
  if (count <= 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return (current + (backwards ? count - 1 : 1)) % count;
}
