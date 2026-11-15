import type { ArcId, ArcPlay } from "./arcs";
import type { ScreenRequest } from "./screen";

/** What kind of screen a request mounts, for deciding where Zoreo looks. */
export type ScreenKind = "life" | "battle" | "interlude" | "menu";

/** Where Zoreo's eyes point: at the side panel (life choices) or at the board (board moves). */
export type Gaze = "panel" | "board";

/**
 * The screen a request ends up on. An arc that opens with an intro card is still a menu until
 * the card is dismissed, so `arcPlay` depends on the arc's play kind.
 */
export function screenKindFor(
  req: ScreenRequest,
  arcPlay: (arc: ArcId) => ArcPlay["kind"],
): ScreenKind {
  switch (req.mode) {
    case "campaign":
    case "life":
      return "life";
    case "battle":
      return "battle";
    case "quiet":
    case "summary":
    case "epilogue":
      return "interlude";
    case "arcPlay": {
      const kind = arcPlay(req.arc);
      if (kind === "battle") return "battle";
      if (kind === "tutorial") return req.part ? "battle" : "menu";
      return req.introSeen ? "life" : "menu";
    }
    case "title":
    case "arcs":
    case "arcComplete":
    case "arcIntro":
    case "continue":
      return "menu";
  }
}

/** Life looks at the panel, battle at the board; summaries and menus have no corner head. */
export function gazeFor(kind: ScreenKind): Gaze | null {
  if (kind === "life") return "panel";
  if (kind === "battle") return "board";
  return null;
}

/**
 * Makes an inline copy of the Zoreo SVG safe to share a page with another copy: the art's `zo-`
 * id prefix becomes `<prefix>-` in ids and in the `url(#…)` and `href="#…"` that point at them.
 * Class names (`zo-lid`) are left alone so one CSS rule reaches every copy.
 */
export function uniquifyIds(svg: string, prefix: string): string {
  return svg
    .replace(/id="zo-/g, `id="${prefix}-`)
    .replace(/url\(#zo-/g, `url(#${prefix}-`)
    .replace(/href="#zo-/g, `href="#${prefix}-`);
}

/** Time to the next idle blink, 2.5 to 6 seconds; `rand` is in [0, 1). */
export function nextBlinkDelayMs(rand: number): number {
  return 2500 + rand * 3500;
}
