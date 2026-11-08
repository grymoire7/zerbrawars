import type { CoachMark } from "../app/coachModel";

// The coach strip (arc1-tutorial-design.md, section 4.1): one line of text and a "Got it" button in
// #coach, the live region at the top of the side panel. It never takes focus. An empty #coach is
// hidden by CSS, so showing nothing costs no room.

export interface CoachStrip {
  /** Shows the mark, or clears the strip with null. */
  update(mark: CoachMark | null): void;
  clear(): void;
}

export function createCoachStrip(
  root: HTMLElement,
  onDismiss: (id: CoachMark["id"]) => void,
): CoachStrip {
  const text = document.createElement("span");
  text.className = "zw-coach-text";
  const got = document.createElement("button");
  got.type = "button";
  got.className = "zw-coach-got";
  got.textContent = "Got it";
  let shown: CoachMark | null = null;
  got.addEventListener("click", () => {
    if (shown) onDismiss(shown.id);
  });
  return {
    update(mark) {
      shown = mark;
      if (!mark) {
        root.replaceChildren();
        return;
      }
      text.textContent = mark.text;
      // Rebuilt only when empty, so the live region announces a change of text, not each refresh.
      if (!root.firstChild) root.append(text, got);
    },
    clear() {
      shown = null;
      root.replaceChildren();
    },
  };
}
