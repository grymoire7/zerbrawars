export interface Help {
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** Opens once per browser; remembers it in localStorage when that works. */
  showFirstTime(): void;
}

const SEEN_KEY = "zebrawars.help.seen";

const LINES: readonly (readonly [string, string])[] = [
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

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage may be blocked; the guide just shows again next time.
  }
}

/** The "How to play" dialog. Escape, the Close button or a click outside dismisses it. */
export function createHelp(root: HTMLElement): Help {
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
  for (const [head, body] of LINES) {
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
      writeSeen();
      returnTo?.focus?.();
    },
    isOpen: () => isOpen,
    showFirstTime() {
      if (!readSeen()) api.open();
    },
  };

  close.addEventListener("click", api.close);
  backdrop.addEventListener("pointerdown", (e) => {
    if (e.target === backdrop) api.close();
  });
  // The dialog holds one control, so Tab just stays on it.
  window.addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      api.close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      close.focus();
    }
  });
  return api;
}
