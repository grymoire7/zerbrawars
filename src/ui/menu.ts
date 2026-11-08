/** One choice on a menu card: a big button with a small line under it, or a greyed note. */
export interface MenuItem {
  readonly label: string;
  readonly sub?: string;
  /** Lines under the button (best scores). */
  readonly lines?: readonly string[];
  /** Absent: shown greyed and not tappable. A returned string is shown under the button (saved). */
  readonly onClick?: () => string | void;
  /** A small item: plain weight and smaller type, for a facilitator's side action. */
  readonly small?: boolean;
}

export interface MenuModel {
  readonly title: string;
  readonly tagline?: string;
  /** A heading over the items. */
  readonly heading?: string;
  /** Paragraphs under the tagline. */
  readonly paragraphs?: readonly string[];
  readonly items?: readonly MenuItem[];
  /** A question card: focus lands on the first button (the safe one) instead of the card. */
  readonly focusFirstButton?: boolean;
  /**
   * Shown over the board instead of covering it (a story card at a fight's end): a see-through
   * backdrop, a raised card, and a `look` button that clears the card to reveal the board, with
   * a `show` tab to bring it back.
   */
  readonly overBoard?: { readonly look: string; readonly show: string };
  readonly buttons?: readonly {
    readonly label: string;
    readonly primary?: boolean;
    /** A returned string is shown under the buttons and the card stays (an export, not an answer). */
    readonly onClick: () => string | void;
  }[];
}

export interface Menu {
  show(model: MenuModel): void;
  /** Hides the card (and its tab) without removing it; `show` brings it back. */
  hide(): void;
  dispose(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css: string,
  text?: string,
) => {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
};

/**
 * A full-window card for the title, the pickers and the arc-complete screen. It covers the board
 * (nothing is playing behind it) and scrolls on a short phone.
 */
export function createMenu(root: HTMLElement): Menu {
  const backdrop = el(
    "div",
    "position:absolute;inset:0;display:none;align-items:safe center;justify-content:center;" +
      "padding:16px;box-sizing:border-box;background:var(--zw-bg);pointer-events:auto;overflow:auto;" +
      "font:15px sans-serif;color:var(--zw-text);",
  );
  const card = el(
    "div",
    "width:min(100%,480px);margin:auto;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;line-height:1.4;outline:none;",
  );
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "menu-title");
  card.tabIndex = -1;
  backdrop.append(card);
  // The tab that brings an over-the-board card back after looking at the board.
  const tab = el(
    "button",
    "position:absolute;left:50%;top:8px;transform:translateX(-50%);display:none;pointer-events:auto;" +
      "min-height:44px;min-width:44px;padding:0 16px;font:inherit;font-weight:700;",
  );
  tab.type = "button";
  root.append(backdrop, tab);
  const setCollapsed = (collapsed: boolean) => {
    backdrop.style.display = collapsed ? "none" : "flex";
    tab.style.display = collapsed ? "" : "none";
    (collapsed ? tab : card).focus();
  };
  tab.addEventListener("click", () => setCollapsed(false));

  const button = (
    label: string,
    primary: boolean,
    onClick: () => string | void,
    report: (line: string) => void = () => {},
  ) => {
    const b = el(
      "button",
      "min-height:44px;min-width:44px;padding:0 16px;font:inherit;" +
        (primary ? "font-weight:700;" : ""),
      label,
    );
    b.type = "button";
    b.addEventListener("click", () => {
      const line = onClick();
      if (typeof line === "string") report(line);
    });
    return b;
  };

  const itemView = (it: MenuItem): HTMLElement => {
    const box = el("div", "display:flex;flex-direction:column;gap:4px;");
    const note = el("div", "font-size:14px;padding:0 4px;");
    note.setAttribute("role", "status");
    const text = (parent: HTMLElement) => {
      parent.append(
        el(
          "span",
          (it.small ? "" : "font-weight:700;") + "overflow-wrap:anywhere;",
          it.label,
        ),
      );
      if (it.sub)
        parent.append(
          el(
            "span",
            "font-size:14px;opacity:0.85;overflow-wrap:anywhere;",
            it.sub,
          ),
        );
    };
    if (it.onClick) {
      const b = el(
        "button",
        "min-height:44px;padding:10px 16px;font:inherit;text-align:left;display:flex;flex-direction:column;gap:2px;",
      );
      b.type = "button";
      text(b);
      const run = it.onClick;
      b.addEventListener("click", () => {
        const line = run();
        if (typeof line === "string") note.textContent = line;
      });
      if (it.small) b.style.fontSize = "14px";
      box.append(b, note);
    } else {
      const g = el(
        "div",
        "min-height:44px;padding:10px 16px;box-sizing:border-box;border-radius:6px;border:1px dashed var(--zw-line);" +
          "opacity:0.55;display:flex;flex-direction:column;gap:2px;",
      );
      g.setAttribute("aria-disabled", "true");
      text(g);
      box.append(g);
    }
    (it.lines ?? []).forEach((l, i) =>
      box.append(
        el(
          "div",
          "font-size:14px;padding:0 4px;opacity:0.9;" +
            (i === 0 ? "font-weight:600;" : ""),
          l,
        ),
      ),
    );
    return box;
  };

  return {
    show(m) {
      const title = el(
        "h1",
        "margin:0;font:700 32px sans-serif;overflow-wrap:anywhere;",
        m.title,
      );
      title.id = "menu-title";
      const kids: HTMLElement[] = [title];
      if (m.tagline)
        kids.push(el("p", "margin:0;font-size:17px;opacity:0.9;", m.tagline));
      for (const p of m.paragraphs ?? []) kids.push(el("p", "margin:0;", p));
      if (m.heading)
        kids.push(
          el("h2", "margin:8px 0 0;font:600 17px sans-serif;", m.heading),
        );
      kids.push(...(m.items ?? []).map(itemView));
      const buttons = [
        ...(m.buttons ?? []),
        ...(m.overBoard
          ? [{ label: m.overBoard.look, onClick: () => setCollapsed(true) }]
          : []),
      ];
      if (buttons.length) {
        const row = el(
          "div",
          "display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;",
        );
        const report = el("p", "margin:0;font-size:14px;width:100%;");
        report.setAttribute("role", "status");
        for (const b of buttons) {
          const btn = button(
            b.label,
            "primary" in b && !!b.primary,
            b.onClick,
            (line) => {
              report.textContent = line;
            },
          );
          btn.style.flex = "1 1 auto";
          row.append(btn);
        }
        row.append(report);
        kids.push(row);
      }
      backdrop.style.background = m.overBoard
        ? "color-mix(in srgb, var(--zw-bg) 60%, transparent)"
        : "var(--zw-bg)";
      card.style.cssText += m.overBoard
        ? "background:var(--zw-raised);border:1px solid var(--zw-line-strong);border-radius:10px;padding:18px 20px;max-height:100%;overflow:auto;"
        : "background:none;border:none;border-radius:0;padding:0;max-height:none;overflow:visible;";
      title.style.fontSize = m.overBoard ? "26px" : "32px";
      tab.textContent = m.overBoard?.show ?? "";
      card.replaceChildren(...kids);
      tab.style.display = "none";
      backdrop.style.display = "flex";
      const first = m.focusFirstButton ? card.querySelector("button") : null;
      (first ?? card).focus();
    },
    hide() {
      backdrop.style.display = "none";
      tab.style.display = "none";
    },
    dispose() {
      backdrop.remove();
      tab.remove();
    },
  };
}
