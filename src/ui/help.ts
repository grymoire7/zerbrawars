import { formNoun, organismDescription, organismName } from "../sim/organisms";

export interface Help {
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** Opens once per browser; remembers it in localStorage when that works. */
  showFirstTime(): void;
  /** Removes the key listener (the screen is being torn down). */
  dispose(): void;
}

export interface HelpOptions {
  readonly lines?: readonly (readonly [string, string])[];
  readonly seenKey?: string;
}

const SEEN_KEY = "zebrawars.help.seen";
/** The life screen and the interludes share this guide, so they share its seen flag. */
export const LIFE_SEEN_KEY = "zebrawars.help.life.seen";
/** Every first-time-help flag in localStorage (Reset for a new player clears them). */
export const HELP_SEEN_KEYS: readonly string[] = [SEEN_KEY, LIFE_SEEN_KEY];

export const BATTLE_LINES: readonly (readonly [string, string])[] = [
  ["Your goal", "Clear the germs from the board before the tissue wears out."],
  [
    "Orders",
    "Each swarm gets one order per turn: move, hold, engulf or wall off. A swarm with no order holds. You can end the turn with any number of orders.",
  ],
  [
    "How to order",
    "Tap a swarm to select it. Then tap a highlighted tile to move there, or tap a germ to engulf it. Tap the swarm again to hold.",
  ],
  [
    "Arrows show what germs do next turn",
    "Yellow arrow: spread to the next tile. Blue dotted arc: a spore lands further away. A germ that slowly swells, with a faint larger outline: it grows (grow 3 to 4). Red cross: blocked by your swarm. If you engulf a germ first, or hit it with a charge, its arrow disappears. A green pause sign and the word stalled: medication is holding that germ back, so it does nothing this turn.",
  ],
  [
    "Germs arrive at doors",
    "More germs come in from the edge of the board. A thick ring with a germ shape and its size marks the door where one arrives at the end of this turn. Tap the ring to read about it. Stand a swarm on the door to meet it there. A dashed ring with a cross means your swarm is already on the door. The side panel shows the turn count and the next arrival.",
  ],
  [
    "Medication",
    "The green glow around the board is your medication. The stronger it is, the more likely each germ is held back (stalled) on any given turn. It slows germs down but never stops them.",
  ],
  [
    "Charges",
    `Medication also gives you charges: antibacterial kills a ${formNoun("bacterium")} (shelled or not), antifungal kills a ${formNoun("mold")}, and a strong charge (from a doctor visit) kills either. A charge only works on small germs (size 2 or less, strong up to 4). Once a turn, pick a charge in the side panel, then tap a green diamond: a germ, or a loaded swarm (which clears one carried germ). No dice are rolled, and a hit germ does nothing that turn. Tap the diamond again, or press Clear, to take it back.`,
  ],
  [
    "Hidden germs",
    "Some germs hide until a swarm steps next to them. The swarm stops there and the germ pops into view.",
  ],
  [
    "Sizes",
    "The number on each germ is its size. Bigger germs grow, spread and heat the tissue more.",
  ],
  [
    "Engulfing",
    `${organismName("strep")}, ${organismDescription("strep")}, is killed when engulfed. A germ with a pale ring (a shell) is not: engulfing it loads your swarm instead, whether it is ${organismName("aspergillus")} or ${organismName("staph")}. Loaded swarms move slower.`,
  ],
  [
    "Wall off",
    "A loaded swarm can wall off, which turns its load into a granuloma: a blocked tile that keeps the germ sealed in. The swarm is busy for a turn.",
  ],
  [
    "Heat",
    "Heated tiles (dots and stripes) cost tissue every turn. A swarm that starts its turn on an inflamed tile moves 1 less. A warm glow with a small flame in a tile corner means it will heat up next turn.",
  ],
];

export const LIFE_LINES: readonly (readonly [string, string])[] = [
  [
    "Your week",
    "Plan three days, with two time slots each: daytime and evening. Hit the goal by saying yes to the people who ask. A time slot with nothing in it is a rest.",
  ],
  [
    "Placing an activity",
    "Tap an activity, then tap a time slot. It works the other way round too: tap a time slot, then pick an activity. Tap an activity on your calendar to take it back off, or press Escape to cancel your pick. Each activity can be used once. Time slots that cannot take it are dimmed and say why.",
  ],
  [
    "The odds are real",
    "Every activity shows its chance of an exposure. When a day is played, each activity rolls once. Look at the body view: more drifting dots means better odds.",
  ],
  [
    "Easier versions",
    "Most activities have an alternative that keeps the plan and the people, but brings fewer germs. Tap it under the activity to swap. It often scores a bit less.",
  ],
  [
    "Medication",
    "Doses follow your routine. Your medication level is your doses over the last three days, and it shows as the green glow. A missed dose dims the glow for a few days. The Medication strip shows each day's dose and its chance. A late-night game night has a 50% chance the evening pills slip.",
  ],
  [
    "Sleepovers",
    "Your pills end up in the other bag. Pack them (costs a little energy) or the next dose is missed. The Medication strip shows which day.",
  ],
  [
    "Energy",
    "Energy is just a game resource for planning, not a measure of your health. Activities spend it, rests give a little back, and a plan can never go below zero.",
  ],
  [
    "The doctor",
    "When a symptom shows up, play stops and a banner offers Book the doctor or Play on. Booking puts a doctor visit on the next free slot.",
  ],
  [
    "After the week",
    "If something landed or flared, you head into a full battle with what you brought in and the medication you kept up. If nothing big landed, your body is still on patrol: a small skirmish, a few turns long.",
  ],
];

function readSeen(seenKey: string): boolean {
  try {
    return window.localStorage.getItem(seenKey) === "1";
  } catch {
    return false;
  }
}

function writeSeen(seenKey: string): void {
  try {
    window.localStorage.setItem(seenKey, "1");
  } catch {
    // Storage may be blocked; the guide just shows again next time.
  }
}

/** The "How to play" dialog. Escape, the Close button or a click outside dismisses it. */
export function createHelp(root: HTMLElement, opts: HelpOptions = {}): Help {
  const lines = opts.lines ?? BATTLE_LINES;
  const seenKey = opts.seenKey ?? SEEN_KEY;
  const backdrop = document.createElement("div");
  backdrop.style.cssText =
    "position:absolute;inset:0;display:none;align-items:center;justify-content:center;" +
    "padding:12px;box-sizing:border-box;background:rgba(14,15,19,0.7);pointer-events:auto;" +
    "font:15px sans-serif;color:var(--zw-text);z-index:5;";

  const card = document.createElement("div");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "help-title");
  card.tabIndex = -1;
  card.style.cssText =
    "background:var(--zw-raised);border:1px solid var(--zw-line-strong);border-radius:10px;padding:16px 18px;" +
    "width:min(100%,520px);max-height:100%;overflow:auto;box-sizing:border-box;" +
    "display:flex;flex-direction:column;gap:10px;";

  const title = document.createElement("h2");
  title.id = "help-title";
  title.textContent = "How to play";
  title.style.cssText = "margin:0;font:600 22px sans-serif;";
  card.append(title);
  for (const [head, body] of lines) {
    const p = document.createElement("p");
    p.style.cssText = "margin:0;line-height:1.4;";
    const b = document.createElement("strong");
    b.textContent = `${head}. `;
    p.append(b, body);
    card.append(p);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Got it";
  close.style.cssText =
    "min-height:44px;min-width:44px;padding:0 16px;font-weight:700;align-self:stretch;";
  card.append(close);
  backdrop.append(card);
  root.append(backdrop);

  let isOpen = false;
  let returnTo: HTMLElement | null = null;
  const api: Help = {
    open() {
      if (isOpen) return;
      isOpen = true;
      returnTo = document.activeElement as HTMLElement | null;
      backdrop.style.display = "flex";
      close.focus({ preventScroll: true });
      card.scrollTop = 0;
    },
    close() {
      if (!isOpen) return;
      isOpen = false;
      backdrop.style.display = "none";
      writeSeen(seenKey);
      returnTo?.focus?.();
    },
    isOpen: () => isOpen,
    dispose: () => window.removeEventListener("keydown", onKey),
    showFirstTime() {
      if (!readSeen(seenKey)) api.open();
    },
  };

  close.addEventListener("click", api.close);
  backdrop.addEventListener("pointerdown", (e) => {
    if (e.target === backdrop) api.close();
  });
  // The dialog holds one control, so Tab just stays on it.
  const onKey = (e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      api.close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      close.focus();
    }
  };
  window.addEventListener("keydown", onKey);
  return api;
}
