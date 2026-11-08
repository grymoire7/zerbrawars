import type { ArcId } from "../app/arcs";
import { copyText, downloadText } from "./download";
import type { SessionDebug } from "./debugPanel";
import {
  BROUGHT_LABEL,
  COPIED_LINE,
  COPY_BLOCKED_LINE,
  COPY_LABEL,
  EXPORT_LABEL,
  FACILITATOR_HEADING,
  PROBE_LABEL,
  RESET_CONFIRM,
  RESET_LABEL,
  SAVED_LINE,
  clearedLine,
  exportFirst,
} from "../app/facilitatorModel";
import {
  MENU_LABELS,
  startOverConfirm,
  trapIndex,
  type MenuItem,
  type StartOverConfirm,
} from "../app/gameMenuModel";

export interface GameMenuOptions {
  /** Under the title; `line` also describes the dialog. */
  readonly where: { readonly line: string; readonly sub: string };
  /** A small line under the two leave items: what leaving keeps or loses. */
  readonly leaveNote: string;
  readonly arc: ArcId;
  /** The items to offer, asked each time the menu opens (a fight that has ended drops one). */
  readonly items: () => readonly MenuItem[];
  /** What each item does; the two start-over items run only after their confirm. */
  readonly on: Record<MenuItem, () => void>;
  readonly facilitator?: FacilitatorMenu;
}

/** The "For the facilitator" block; present only with ?facilitator=1. */
export interface FacilitatorMenu {
  /** The run's switches and log; absent on a screen with no run (the single Arc 1 fight). */
  readonly session?: SessionDebug;
  /** Clears best scores, first-time help and the held summer; true if a summer was held. */
  reset(): boolean;
  /** Leaves for the title after a reset. */
  toTitle(): void;
}

export interface GameMenu {
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** Removes the button and the dialog, and the key listener. */
  dispose(): void;
}

const KEEP = "Keep playing";

const WIDE = "(min-width: 900px)";

function text(tag: "div" | "p" | "h2", css: string, content: string) {
  const e = document.createElement(tag);
  e.style.cssText = css;
  e.textContent = content;
  return e;
}

function checkRow(label: string, on: boolean, change: (v: boolean) => void) {
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = on;
  cb.style.cssText = "width:22px;height:22px;margin:0;flex:none;";
  cb.addEventListener("change", () => change(cb.checked));
  const row = document.createElement("label");
  row.style.cssText =
    "display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;";
  row.append(cb, label);
  return row;
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
 * The in-game menu: a corner button and the dialog it opens (Keep playing, then the items the
 * screen offers). Starting a fight or a summer over asks first, in the card itself; choosing
 * another arc or changing character asks nothing, since the run waits. The button is the first
 * child of `root` so it leads the tab order, and it sits above
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

  const note = text(
    "p",
    "margin:0;line-height:1.4;opacity:0.85;font-size:14px;",
    opts.leaveNote,
  );
  const list = document.createElement("div");
  list.style.cssText = "display:flex;flex-direction:column;gap:8px;";

  let keep = button(KEEP, "font-weight:700;", () => api.close());
  const buttons = (): HTMLButtonElement[] => [
    ...list.querySelectorAll<HTMLButtonElement>("button, input"),
  ];

  /** Keep playing, then the screen's items; the leave note follows the leave items. */
  const showItems = () => {
    keep = button(KEEP, "font-weight:700;", () => api.close());
    const rows: HTMLElement[] = [keep];
    for (const item of opts.items()) {
      const confirms = item === "restartFight" || item === "restartSummer";
      rows.push(
        button(MENU_LABELS[item], "", () => {
          if (confirms) return showConfirm(item);
          api.close();
          opts.on[item]();
        }),
      );
      if (item === "changeCharacter") rows.push(note);
    }
    rows.push(...facilitatorRows());
    list.replaceChildren(...rows);
    card.setAttribute("aria-describedby", "game-menu-where");
  };

  /** A line the facilitator block reports into (saved, copied); cleared when the list is rebuilt. */
  const status = text("p", "margin:0;min-height:1.2em;font-size:14px;", "");
  status.setAttribute("role", "status");

  /** The facilitator block: the two switches, the log, and Reset for a new player. */
  const facilitatorRows = (): HTMLElement[] => {
    const f = opts.facilitator;
    if (!f) return [];
    status.textContent = "";
    const rows: HTMLElement[] = [
      text(
        "div",
        "margin-top:10px;padding-top:10px;border-top:1px solid var(--zw-line);font-weight:700;",
        FACILITATOR_HEADING,
      ),
    ];
    const s = f.session;
    if (s) {
      const logRow = document.createElement("div");
      logRow.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
      const exp = button(EXPORT_LABEL, "flex:1 1 auto;", () => {
        downloadText(s.fileName, s.exportJson());
        status.textContent = SAVED_LINE;
      });
      const copy = button(COPY_LABEL, "flex:1 1 auto;", () => {
        void copyText(s.exportJson()).then((ok) => {
          status.textContent = ok ? COPIED_LINE : COPY_BLOCKED_LINE;
        });
      });
      logRow.append(exp, copy);
      rows.push(
        checkRow(PROBE_LABEL, s.probe, s.onProbe),
        checkRow(BROUGHT_LABEL, s.brought, s.onBrought),
        logRow,
        status,
      );
    }
    rows.push(button(RESET_LABEL, "", () => showResetConfirm()));
    return rows;
  };

  /**
   * A confirm swaps in place: the safe button first, bold and focused. A facilitator whose answer
   * would lose a run also gets the export-first line and button, between the two answers.
   */
  const ask = (
    c: StartOverConfirm,
    canExport: boolean,
    onGo: () => void,
    onKeep: () => void,
  ) => {
    const q = text(
      "p",
      "margin:0;line-height:1.4;font-weight:600;",
      c.question,
    );
    q.id = "game-menu-confirm";
    const detail = text("p", "margin:0;line-height:1.4;", c.detail);
    keep = button(c.keep, "font-weight:700;", onKeep);
    const rows: HTMLElement[] = [q, detail, keep];
    const first = exportFirst(true, canExport);
    const s = opts.facilitator?.session;
    if (first && s) {
      status.textContent = "";
      rows.push(
        text("p", "margin:0;line-height:1.4;", first.line),
        button(first.button, "", () => {
          downloadText(s.fileName, s.exportJson());
          status.textContent = SAVED_LINE;
        }),
        status,
      );
    }
    rows.push(button(c.go, "", onGo));
    list.replaceChildren(...rows);
    card.setAttribute("aria-describedby", "game-menu-confirm");
    keep.focus({ preventScroll: true });
  };

  const showConfirm = (item: "restartFight" | "restartSummer") =>
    ask(
      startOverConfirm(item, opts.arc),
      item === "restartSummer" && !!opts.facilitator,
      () => {
        api.close();
        opts.on[item]();
      },
      () => api.close(),
    );

  /** Reset for a new player: Cancel returns to the menu; Clear reports what it cleared. */
  const showResetConfirm = () =>
    ask(
      RESET_CONFIRM,
      true,
      () => {
        const f = opts.facilitator;
        if (!f) return;
        const line = text(
          "p",
          "margin:0;line-height:1.4;font-weight:600;",
          clearedLine(f.reset()),
        );
        line.id = "game-menu-cleared";
        const toTitle = button("Go to the title", "font-weight:700;", () => {
          api.close();
          f.toTitle();
        });
        list.replaceChildren(line, toTitle);
        card.setAttribute("aria-describedby", "game-menu-cleared");
        toTitle.focus({ preventScroll: true });
      },
      () => {
        showItems();
        keep.focus({ preventScroll: true });
      },
    );

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
      showItems();
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
      const stops = buttons().filter((b) => b.getClientRects().length > 0);
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
