export interface InterludeModel {
  readonly title: string;
  readonly lead: string;
  /** Paragraphs under the lead. */
  readonly notes: readonly string[];
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

/** A calm card over the body view: the quiet-week beat and the campaign summary. */
export function createInterlude(root: HTMLElement): Interlude {
  const backdrop = document.createElement("div");
  backdrop.style.cssText =
    "position:absolute;inset:0;display:none;align-items:center;justify-content:center;" +
    "padding:12px;box-sizing:border-box;background:rgba(14,15,19,0.55);pointer-events:auto;" +
    "font:15px sans-serif;color:#e4e7ee;";
  const card = document.createElement("div");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "interlude-title");
  card.tabIndex = -1;
  card.style.cssText =
    "background:#23262e;border:1px solid #4a505e;border-radius:10px;padding:18px 20px;" +
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
      const notes = m.notes.map((t) => {
        const p = document.createElement("p");
        p.style.cssText = "margin:0;opacity:0.9;";
        p.textContent = t;
        return p;
      });
      const groups = m.groups.map((g) => {
        const box = document.createElement("div");
        box.style.cssText =
          "padding:8px 10px;border-radius:6px;background:#2c2f38;display:flex;flex-direction:column;gap:2px;font-size:14px;";
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
      card.replaceChildren(title, lead, ...notes, ...groups, row);
      backdrop.style.display = "flex";
      card.focus();
    },
    dispose: () => backdrop.remove(),
  };
}
