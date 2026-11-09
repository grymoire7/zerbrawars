/** The campaign score: a card per week, a total line, the best lines and a framing line. */
export interface ScoreCardModel {
  /** "Goals met: 2 of 2. You lived it fully." */
  readonly headline: string;
  readonly weeks: readonly {
    readonly head: string;
    readonly odds: string;
    readonly choices: string;
    readonly outcome: string;
  }[];
  readonly total: string;
  readonly best: readonly string[];
  readonly framing: string;
}

export interface InterludeModel {
  readonly title: string;
  readonly lead: string;
  /** The campaign summary's score block, under the lead. */
  readonly score?: ScoreCardModel;
  /** Paragraphs under the lead. */
  readonly notes: readonly string[];
  /** Closing paragraphs after everything else, just above the buttons. */
  readonly closing?: readonly string[];
  /** Titled groups of short lines (a week each, in the summary). */
  readonly groups: readonly {
    readonly head: string;
    readonly lines: readonly string[];
  }[];
  readonly buttons: readonly {
    readonly label: string;
    readonly primary?: boolean;
    readonly onClick: () => void;
  }[];
}

export interface Interlude {
  show(model: InterludeModel): void;
  dispose(): void;
}

function scoreView(s: ScoreCardModel): HTMLElement[] {
  const line = (text: string, css = "") => {
    const d = document.createElement("div");
    d.style.cssText = css;
    d.textContent = text;
    return d;
  };
  const box = (css: string, ...kids: HTMLElement[]) => {
    const b = document.createElement("div");
    b.style.cssText =
      "padding:8px 10px;border-radius:6px;background:var(--zw-control);display:flex;flex-direction:column;gap:2px;font-size:14px;" +
      css;
    b.append(...kids);
    return b;
  };
  const headline = line(s.headline, "font-weight:700;");
  const weeks = s.weeks.map((w) =>
    box(
      "",
      line(w.head, "font-weight:600;"),
      line(w.odds),
      line(w.choices),
      line(w.outcome),
    ),
  );
  const total = box("", line(s.total, "font-weight:700;"));
  const best = s.best.map((t, i) =>
    line(t, i === 0 ? "font-weight:700;" : "opacity:0.9;"),
  );
  const framing = line(s.framing, "font-size:13px;opacity:0.8;");
  return [headline, ...weeks, total, ...best, framing];
}

/** A calm card over the body view: the quiet-week beat and the campaign summary. */
export function createInterlude(root: HTMLElement): Interlude {
  const backdrop = document.createElement("div");
  backdrop.style.cssText =
    "position:absolute;inset:0;display:none;align-items:center;justify-content:center;" +
    "padding:60px 12px 12px;box-sizing:border-box;background:rgba(14,15,19,0.55);pointer-events:auto;" +
    "font:15px sans-serif;color:var(--zw-text);";
  const card = document.createElement("div");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "interlude-title");
  card.tabIndex = -1;
  card.style.cssText =
    "background:var(--zw-raised);border:1px solid var(--zw-line-strong);border-radius:10px;padding:18px 20px;" +
    "width:min(100%,520px);max-height:100%;overflow:auto;box-sizing:border-box;" +
    "display:flex;flex-direction:column;gap:10px;line-height:1.4;";
  backdrop.append(card);
  root.append(backdrop);

  return {
    show(m) {
      const title = document.createElement("h2");
      title.id = "interlude-title";
      title.style.cssText = "margin:0;font:600 24px sans-serif;";
      title.textContent = m.title;
      const lead = document.createElement("p");
      lead.style.cssText = "margin:0;";
      lead.textContent = m.lead;
      const scoreBlock = m.score ? scoreView(m.score) : [];
      const notes = m.notes.map((t) => {
        const p = document.createElement("p");
        p.style.cssText = "margin:0;opacity:0.9;";
        p.textContent = t;
        return p;
      });
      const groups = m.groups.map((g) => {
        const box = document.createElement("div");
        box.style.cssText =
          "padding:8px 10px;border-radius:6px;background:var(--zw-control);display:flex;flex-direction:column;gap:2px;font-size:14px;";
        const h = document.createElement("div");
        h.style.fontWeight = "600";
        h.textContent = g.head;
        box.append(h);
        for (const l of g.lines) {
          const d = document.createElement("div");
          d.textContent = l;
          box.append(d);
        }
        return box;
      });
      const closing = (m.closing ?? []).map((t) => {
        const p = document.createElement("p");
        p.style.cssText = "margin:0;";
        p.textContent = t;
        return p;
      });
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;";
      for (const b of m.buttons) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = b.label;
        btn.style.cssText =
          "min-height:44px;min-width:44px;padding:0 16px;font:inherit;flex:1 1 auto;" +
          (b.primary ? "font-weight:700;" : "");
        btn.addEventListener("click", b.onClick);
        row.append(btn);
      }
      card.replaceChildren(
        title,
        lead,
        ...scoreBlock,
        ...notes,
        ...groups,
        ...closing,
        row,
      );
      backdrop.style.display = "flex";
      card.focus();
    },
    dispose: () => backdrop.remove(),
  };
}
