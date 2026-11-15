import { nextBlinkDelayMs, uniquifyIds } from "../app/zoreoModel";
import { calm } from "../render/motion";
import bokeh from "./titleScene/pieces/B-bokeh.svg?raw";
import island from "./titleScene/pieces/B-board-island.svg?raw";
import germAsp from "./titleScene/pieces/germ-asp.svg?raw";
import germTeal from "./titleScene/pieces/germ-teal.svg?raw";
import germOrange from "./titleScene/pieces/germ-orange.svg?raw";
import hero from "./titleScene/pieces/B-zoreo-popup-hole.svg?raw";
import wordmark from "./titleScene/pieces/wordmark.svg?raw";

/** The pop-up title scene: a fixed, decorative layer behind the menu card (docs/specs/title-zoreo-design.md). */
export interface TitleScene {
  dispose(): void;
}

/**
 * One piece as inline markup: its ids get a prefix of their own (the pieces all start from `zs-`
 * and several repeat the same gradients), and the root gets the class the CSS in index.html styles.
 */
function piece(svg: string, tag: string, cls: string): string {
  const unique = uniquifyIds(svg, tag, "zs-");
  return unique.replace(/^<svg ([^>]*)>/, (_all, attrs: string) => {
    const rest = attrs.replace(/\sclass="[^"]*"/, "");
    return `<svg class="${cls}" ${rest}>`;
  });
}

const SCENE_HTML =
  '<div class="zs-rays"></div>' +
  piece(bokeh, "zbk", "zs-bokeh") +
  piece(island, "zis", "zs-island") +
  piece(germAsp, "zga", "zs-germ zs-g-asp") +
  piece(germOrange, "zgr", "zs-germ zs-g-orange") +
  piece(germTeal, "zgt", "zs-germ zs-g-teal") +
  piece(hero, "zhe", "zs-hero");

/** The glossy "Zebra Wars" wordmark as inline markup (decorative; the heading keeps the text). */
export function wordmarkMarkup(): string {
  return piece(wordmark, "zwm", "zs-wordmark");
}

// The opening beat (Zoreo pops up, the volley fires and freezes) plays once per page load; its
// keyframes are `.zs-play` in index.html and total about this long.
const OPENING_MS = 1700;
const BLINK_MS = 180;
let opened = false;

/**
 * Adds the scene to `root` just before `before` (the menu backdrop), so the card sits above it.
 * The first scene of a page load plays the opening beat and every scene blinks now and then; with
 * reduced motion (`calm()`) it is the still final frame.
 */
export function createTitleScene(
  root: HTMLElement,
  before: Node | null = null,
): TitleScene {
  const el = document.createElement("div");
  el.className = "zs-scene";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = SCENE_HTML;
  root.insertBefore(el, before);

  let idle: ReturnType<typeof setTimeout> | undefined;
  let blinkEnd: ReturnType<typeof setTimeout> | undefined;
  let opening: ReturnType<typeof setTimeout> | undefined;
  const blink = () => {
    el.classList.add("zs-blink");
    clearTimeout(blinkEnd);
    blinkEnd = setTimeout(() => el.classList.remove("zs-blink"), BLINK_MS);
  };
  const arm = () => {
    idle = setTimeout(() => {
      if (!calm()) blink();
      arm();
    }, nextBlinkDelayMs(Math.random()));
  };
  if (!opened && !calm()) {
    el.classList.add("zs-play");
    opening = setTimeout(() => {
      el.classList.remove("zs-play");
      blink();
    }, OPENING_MS);
  }
  opened = true;
  arm();
  return {
    dispose() {
      clearTimeout(idle);
      clearTimeout(blinkEnd);
      clearTimeout(opening);
      el.remove();
    },
  };
}
