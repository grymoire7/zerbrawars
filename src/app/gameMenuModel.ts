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

/** The line under the two leave items: a summer is held; a single fight is not. */
export function leaveNote(arc: ArcId, finished = false): string {
  if (finished) return "This summer is finished, and your score is saved.";
  return arcById(arc).play.kind === "campaign"
    ? "Your summer waits. Continue it from the title or the arc list."
    : "This fight is not kept. You would start it again from the beginning.";
}

/** The items of the in-game menu below Keep playing, in order. */
export type MenuItem =
  "help" | "restartFight" | "restartSummer" | "chooseArc" | "changeCharacter";

export const MENU_LABELS: Record<MenuItem, string> = {
  help: "How to play",
  restartFight: "Start this fight over",
  restartSummer: "Start this summer over",
  chooseArc: "Choose another arc",
  changeCharacter: "Change character",
};

/**
 * Which items the menu offers. A fight can be started over only on a battle screen and only while
 * it is on; a summer can be started over only in Arc 2. Choosing another arc and changing
 * character are always offered: neither asks anything, since a summer is held.
 */
export function menuItems(c: {
  readonly arc: ArcId;
  /** `interlude`: the quiet week and the summary, which have their own buttons. */
  readonly screen: "life" | "battle" | "interlude";
  /** The fight has ended (its outcome card is up). */
  readonly fightOver: boolean;
}): MenuItem[] {
  const summer =
    c.screen !== "interlude" && arcById(c.arc).play.kind === "campaign";
  return [
    "help",
    ...(c.screen === "battle" && !c.fightOver ? ["restartFight" as const] : []),
    ...(summer ? ["restartSummer" as const] : []),
    "chooseArc",
    "changeCharacter",
  ];
}

export interface StartOverConfirm {
  readonly question: string;
  readonly detail: string;
  readonly keep: string;
  readonly go: string;
}

/**
 * The in-menu confirm for the two start-over items. Keeping comes first. A fight started over keeps
 * the week and its score so far (the fight's result is only taken when it ends); a summer started
 * over loses the run, though best scores stay.
 */
export function startOverConfirm(
  item: "restartFight" | "restartSummer",
  arc: ArcId,
): StartOverConfirm {
  if (item === "restartSummer")
    return {
      question: "Start this summer over from week 1?",
      detail:
        "What you have played so far will be lost. It will be the same summer, with a fresh start.",
      keep: "Keep playing",
      go: "Start over",
    };
  return {
    question: "Start this fight over from turn 1?",
    detail:
      arcById(arc).play.kind === "campaign"
        ? "The moves you made in it will be undone. Your week and its score so far are kept."
        : "The moves you made in it will be undone.",
    keep: "Keep playing",
    go: "Start over",
  };
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
