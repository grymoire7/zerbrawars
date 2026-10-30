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
    "Medication",
    "The green glow around the board is your medication. The stronger it is, the more likely each germ is held back (stalled) on any given turn. It slows germs down but never stops them.",
  ],
  [
    "Charges",
    "Medication also gives you charges: antibacterial kills a round bacterium, antifungal kills a shelled fungus, and a strong charge (from a doctor visit) kills either. A charge only works on small germs (size 2 or less, strong up to 4). Once a turn, pick a charge in the side panel, then tap a green diamond: a germ, or a loaded swarm (which clears one carried germ). No dice are rolled, and a hit germ does nothing that turn. Tap the diamond again, or press Clear, to take it back.",
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
    "Round bacteria are killed when engulfed. Shelled fungus is not: it loads your swarm instead. Loaded swarms move slower.",
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
    "Plan three days, two slots each: daytime and evening. Hit the goal by saying yes to the people who ask. A slot with nothing in it is a rest.",
  ],
  [
    "Placing a card",
    "Tap a card, then tap a slot. Tap a card on your calendar to take it back off. Each card can be used once. Slots that cannot take it are dimmed and say why.",
  ],
  [
    "The odds are real",
    "Every card shows its chance of an exposure. When a day is played, each card rolls once. Look at the body view: more drifting dots means better odds.",
  ],
  [
    "Easier versions",
    "Most cards have an alternative that keeps the plan and the people, but brings fewer germs. Tap it on the card to swap. It often scores a bit less.",
  ],
  [
    "Medication",
    "Tap Take meds each morning to keep your streak. Your medication level is your doses over the last three days, and it shows as the green glow. Skip a dose and the glow dims for a few days. A day with no tap counts as taken.",
  ],
  [
    "Sleepovers",
    "Your pills end up in the other bag. Pack them (costs a little energy) or tomorrow's dose is missed. The week view shows which day.",
  ],
  [
    "Energy",
    "Energy is just a game resource for planning, not a measure of your health. Cards spend it, rests give a little back, and a plan can never go below zero.",
  ],
  [
    "After the week",
    "If something landed, you head into a battle with what you brought in and the medication you kept up. If nothing landed, it was a quiet week.",
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
    "font:15px sans-serif;color:#e4e7ee;z-index:5;";

  const card = document.createElement("div");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "help-title");
  card.tabIndex = -1;
  card.style.cssText =
    "background:#23262e;border:1px solid #4a505e;border-radius:10px;padding:16px 18px;" +
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
      close.focus();
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
