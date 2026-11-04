import type { PaletteName } from "../theme/palette";

// Each activity card family has its own colour and each card its own icon, so cards can be told
// apart at a glance. Colour never carries meaning alone: the icon and the title ride with it.

export type CardFamily =
  "yard" | "lake" | "band" | "sleepover" | "game" | "doctor" | "rest";

/** The family colour of every card id (and "rest"). */
export const CARD_FAMILY: Readonly<Record<string, CardFamily>> = {
  yard: "yard",
  yardIndoor: "yard",
  lake: "lake",
  beach: "lake",
  band: "band",
  sleepover: "sleepover",
  game: "game",
  gameEarly: "game",
  doctor: "doctor",
  rest: "rest",
};

/** 24x24 outline icons, drawn in currentColor. */
export const CARD_ICON: Readonly<Record<string, string>> = {
  // A leaf with its vein.
  yard: '<path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z"/><path d="M5 19 14 10"/>',
  // A house with a door.
  yardIndoor:
    '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  // Three waves.
  lake: '<path d="M2 8q2.5-3 5 0t5 0 5 0 5 0"/><path d="M2 13q2.5-3 5 0t5 0 5 0 5 0"/><path d="M2 18q2.5-3 5 0t5 0 5 0 5 0"/>',
  // A sun over two waves.
  beach:
    '<circle cx="12" cy="8" r="4"/><path d="M2 16q2.5-3 5 0t5 0 5 0 5 0"/><path d="M2 21q2.5-3 5 0t5 0 5 0 5 0"/>',
  // A pair of music notes.
  band: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  // A crescent moon.
  sleepover: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
  // A die showing five.
  game: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01"/>',
  // A clock: home in time.
  gameEarly: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
  // A medical cross.
  doctor: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  // Two Zs.
  rest: '<path d="M4 5h7L4 12h7"/><path d="M13 13h6l-6 7h6"/>',
};

/** The accent colour token of a card id (or "rest"). */
export function cardAccent(id: string): PaletteName {
  return `card-${CARD_FAMILY[id] ?? "rest"}`;
}

/** The dark tint token of a card id (or "rest"), for the card body. */
export function cardTint(id: string): PaletteName {
  return `card-${CARD_FAMILY[id] ?? "rest"}-bg`;
}

/** A round badge in the family colour holding the icon. Decorative: aria-hidden. */
export function cardBadge(id: string, size = 32): HTMLElement {
  const badge = document.createElement("span");
  badge.setAttribute("aria-hidden", "true");
  badge.dataset.icon = id;
  const pad = Math.round(size * 0.2);
  badge.style.cssText =
    `flex:none;display:inline-flex;align-items:center;justify-content:center;` +
    `width:${size}px;height:${size}px;border-radius:50%;box-sizing:border-box;padding:${pad}px;` +
    `background:var(--zw-${cardAccent(id)});color:var(--zw-bg);`;
  badge.innerHTML =
    `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" ` +
    `stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" focusable="false">` +
    `${CARD_ICON[id] ?? CARD_ICON.rest}</svg>`;
  return badge;
}
