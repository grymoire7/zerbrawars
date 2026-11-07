import { trapIndex } from "../app/gameMenuModel";

export interface GameMenuOptions {
  /** Under the title; `line` also describes the dialog. */
  readonly where: { readonly line: string; readonly sub: string };
  /** A small line under "Back to the title": what leaving keeps or loses. */
  readonly leaveNote: string;
  readonly onHelp: () => void;
  readonly onLeave: () => void;
}

export interface GameMenu {
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** Removes the button and the dialog, and the key listener. */
  dispose(): void;
}

const KEEP = "Keep playing";
const HELP = "How to play";
const LEAVE = "Back to the title";

const WIDE = "(min-width: 900px)";

function text(tag: "div" | "p" | "h2", css: string, content: string) {
  const e = document.createElement(tag);
  e.style.cssText = css;
  e.textContent = content;
  return e;
}

function button(label: string, css: string, onClick: () => void) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.cssText = `min-height:44px;min-width:44px;padding:0 16px;${css}`;
  b.addEventListener("click", onClick);
  return b;
}

/**
 * The in-game menu: a corner button and the dialog it opens (Keep playing, How to play, Back to
 * the title, which asks nothing: the run waits there). The button is the first child of `root` so it leads the tab order, and it sits above
 * the screen overlays (outcome, interlude, brought strip) but under the dialogs (help, probe, this
 * menu). While the menu is open it owns the keyboard: Escape closes it and Tab cycles inside.
 */
export function createGameMenu(
  root: HTMLElement,
  opts: GameMenuOptions,
): GameMenu {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.setAttribute("aria-label", "Menu");
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  trigger.style.cssText =
    "position:absolute;left:max(8px,env(safe-area-inset-left));top:max(8px,env(safe-area-inset-top));" +
    "min-width:44px;min-height:44px;padding:0 12px;box-sizing:border-box;pointer-events:auto;" +
    "background:color-mix(in srgb,var(--zw-raised) 88%,transparent);cursor:pointer;z-index:3;" +
    "display:inline-flex;align-items:center;justify-content:center;gap:6px;font-weight:600;";
  const icon = text("div", "font-size:20px;line-height:1;", "☰");
  icon.setAttribute("aria-hidden", "true");
  const word = text("div", "", "Menu");
  word.setAttribute("aria-hidden", "true");
  trigger.append(icon, word);
  const wide = window.matchMedia(WIDE);
  const showWord = () => {
    word.style.display = wide.matches ? "" : "none";
  };
  showWord();
  wide.addEventListener("change", showWord);

  const backdrop = document.createElement("div");
  backdrop.style.cssText =
    "position:absolute;inset:0;display:none;align-items:center;justify-content:center;" +
    "padding:12px;box-sizing:border-box;background:rgba(14,15,19,0.7);pointer-events:auto;" +
    "font:15px sans-serif;color:var(--zw-text);z-index:6;";
  const card = document.createElement("div");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "game-menu-title");
  card.setAttribute("aria-describedby", "game-menu-where");
  card.tabIndex = -1;
  card.style.cssText =
    "background:var(--zw-raised);border:1px solid var(--zw-line-strong);border-radius:10px;padding:16px 18px;" +
    "width:min(100%,420px);max-height:100%;overflow:auto;box-sizing:border-box;" +
    "display:flex;flex-direction:column;gap:10px;";
  const title = text("h2", "margin:0;font:600 22px sans-serif;", "Menu");
  title.id = "game-menu-title";
  const where = text("p", "margin:0;line-height:1.4;", opts.where.line);
  where.id = "game-menu-where";
  const sub = text(
    "p",
    "margin:0;line-height:1.4;opacity:0.85;font-size:14px;",
    opts.where.sub,
  );

  const keep = button(KEEP, "font-weight:700;", () => api.close());
  const help = button(HELP, "", () => {
    api.close();
    opts.onHelp();
  });
  const leave = button(LEAVE, "", () => {
    api.close();
    opts.onLeave();
  });
  const note = text(
    "p",
    "margin:0;line-height:1.4;opacity:0.85;font-size:14px;",
    opts.leaveNote,
  );
  const list = document.createElement("div");
  list.style.cssText = "display:flex;flex-direction:column;gap:8px;";
  list.append(keep, help, leave, note);

  card.append(title, where, sub, list);
  backdrop.append(card);
  root.append(backdrop);
  root.prepend(trigger);

  let isOpen = false;
  let returnTo: HTMLElement | null = null;
  const api: GameMenu = {
    open() {
      if (isOpen) return;
      isOpen = true;
      const was = document.activeElement as HTMLElement | null;
      returnTo = was && was !== document.body ? was : null;
      backdrop.style.display = "flex";
      trigger.setAttribute("aria-expanded", "true");
      card.scrollTop = 0;
      keep.focus({ preventScroll: true });
    },
    close() {
      if (!isOpen) return;
      isOpen = false;
      backdrop.style.display = "none";
      trigger.setAttribute("aria-expanded", "false");
      const back = returnTo?.isConnected ? returnTo : trigger;
      back.focus({ preventScroll: true });
    },
    isOpen: () => isOpen,
    dispose() {
      window.removeEventListener("keydown", onKey, true);
      wide.removeEventListener("change", showWord);
      trigger.remove();
      backdrop.remove();
    },
  };

  trigger.addEventListener("click", api.open);
  backdrop.addEventListener("pointerdown", (e) => {
    if (e.target === backdrop) api.close();
  });
  // In the capture phase, so while the menu is open nothing behind it (battle shortcuts, an
  // outcome card's Escape) sees the key.
  const onKey = (e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      api.close();
    } else if (e.key === "Tab") {
      e.preventDefault();
      e.stopImmediatePropagation();
      const stops = [keep, help, leave].filter(
        (b) => b.getClientRects().length > 0,
      );
      const at = trapIndex(
        stops.indexOf(document.activeElement as HTMLButtonElement),
        stops.length,
        e.shiftKey,
      );
      stops[at]?.focus();
    } else {
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener("keydown", onKey, true);
  return api;
}
