import type { PaletteName } from "../theme/palette";

// Each activity card family has its own colour and each card its own icon, so cards can be told
// apart at a glance. Colour never carries meaning alone: the icon and the title ride with it.

export type CardFamily =
  | "yard"
  | "lake"
  | "band"
  | "sleepover"
  | "game"
  | "doctor"
  | "rest"
  | "wood"
  | "crawl"
  | "flytrap"
  | "trip";

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
  wood: "wood",
  woodDry: "wood",
  crawl: "crawl",
  crawlRake: "crawl",
  flytrap: "flytrap",
  flytrapGarage: "flytrap",
  trip: "trip",
  tripPlan: "trip",
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
  // A log, cut end showing its rings.
  wood: '<path d="M4 8v8a8 3 0 0 0 16 0V8"/><ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M12 8h.01M9.5 8a2.5 1 0 0 1 5 0"/>',
  // A sun over a log: dry wood, out in the open.
  woodDry:
    '<circle cx="12" cy="7" r="3"/><path d="M12 1.5v1M5.5 4l.7.7M18.5 4l-.7.7M3 8h1M20 8h1"/><path d="M4 14h13v7H4z"/><ellipse cx="17" cy="17.5" rx="3" ry="3.5"/><path d="M17 17.5h.01"/>',
  // A ball and a low arch.
  crawl:
    '<circle cx="7" cy="16" r="3.5"/><path d="M3 21h18"/><path d="M12 21v-4a5 5 0 0 1 10 0v4"/>',
  // The same arch with a rake: the cleared yard.
  crawlRake:
    '<path d="M2 21h20"/><path d="M4 21v-4a4 4 0 0 1 8 0v4"/><path d="M15 4v10"/><path d="M12 14h6M12 14v4M15 14v4M18 14v4"/>',
  // A leaf with a toothed edge.
  flytrap:
    '<path d="M3 12 6 7l2 3 4-5 2 4 3-3 2 4 2 0c0 6-5 10-10 10-3 0-5-1-7-3z"/><path d="M5 19 14 11"/>',
  // A garage door: the trap kept out of the living space.
  flytrapGarage:
    '<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-8h10v8"/><path d="M7 14.5h10M7 17h10"/>',
  // A suitcase.
  trip: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V5h6v3"/><path d="M4 13h16"/>',
  // A suitcase with a checked list.
  tripPlan:
    '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M9 8V5h6v3"/><path d="m8.5 14.5 2 2 4-4"/>',
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
