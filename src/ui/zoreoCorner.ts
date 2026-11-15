import { calm } from "../render/motion";
import { nextBlinkDelayMs, uniquifyIds, type Gaze } from "../app/zoreoModel";
import zoreoSvg from "./zoreo/Zoreo.svg?raw";

/** Zoreo's head in the corner of the board; where he looks says which phase the player is in. */
export interface ZoreoCorner {
  /** Look at the panel or the board, or hide. Idempotent; a change of gaze blinks once. */
  set(gaze: Gaze | null): void;
  dispose(): void;
}

// The corner crop of the art (docs: src/ui/zoreo/README.md): ears, mohawk, snout and blue band.
const CORNER_VIEWBOX = 'viewBox="16 -26 240 270"';
const ART_VIEWBOX = 'viewBox="0 -26 254 306"';
const BLINK_MS = 180;

let copies = 0;

/**
 * Adds the corner head to `board` (a positioned element). Placement and the turn are CSS, keyed on
 * `data-gaze`, because they depend on the layout (see the `#zoreo-corner` rules in index.html).
 */
export function createZoreoCorner(board: HTMLElement): ZoreoCorner {
  const el = document.createElement("div");
  el.id = "zoreo-corner";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = uniquifyIds(zoreoSvg, `zc${++copies}`)
    .replace(ART_VIEWBOX, CORNER_VIEWBOX)
    .replace("<svg ", '<svg focusable="false" ');
  board.append(el);

  let gaze: Gaze | null = null;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let blinkEnd: ReturnType<typeof setTimeout> | undefined;

  const blink = () => {
    if (calm()) return;
    el.classList.add("blink");
    clearTimeout(blinkEnd);
    blinkEnd = setTimeout(() => el.classList.remove("blink"), BLINK_MS);
  };
  const arm = () => {
    idle = setTimeout(() => {
      if (gaze) blink();
      arm();
    }, nextBlinkDelayMs(Math.random()));
  };
  arm();

  return {
    set(next) {
      el.toggleAttribute("data-calm", calm());
      if (next === gaze) return;
      gaze = next;
      if (next) {
        el.dataset.gaze = next;
        blink();
      } else {
        delete el.dataset.gaze;
      }
    },
    dispose() {
      clearTimeout(idle);
      clearTimeout(blinkEnd);
      el.remove();
    },
  };
}
