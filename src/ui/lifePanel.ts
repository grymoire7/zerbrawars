import type { DoseCell } from "../app/lifeModel";
import type { HudMounts } from "./hud";

// The calendar screen's side panel. Views are read-only: the app builds a LifePanelModel from the
// life state and passes handlers back; the panel never touches sim state.

export interface LifeCardModel {
  readonly base: string;
  readonly version: string;
  readonly label: string;
  readonly people: string;
  readonly blurb: string;
  readonly points: number;
  readonly energy: number;
  readonly odds: string;
  readonly chance: number;
  /** The other version, offered as an easy swap. */
  readonly alt: {
    readonly version: string;
    readonly text: string;
    readonly odds: string;
  } | null;
  /** Overnight cards: what leaving or packing the pills means. */
  readonly pills: { readonly packed: boolean; readonly extra: number } | null;
  readonly placedAt: string | null;
  /** The doctor card's body; replaces the odds, since a visit brings nothing in. */
  readonly doctor: readonly string[] | null;
  readonly selected: boolean;
  readonly played: boolean;
}

export interface LifeSlotModel {
  readonly day: number;
  readonly slot: number;
  readonly name: string;
  readonly card: {
    readonly label: string;
    readonly points: number;
    readonly pills: "packed" | "left" | null;
  } | null;
  readonly played: boolean;
  readonly today: boolean;
  /** While a card is picked: can it go here, and why not. */
  readonly target: { readonly ok: boolean; readonly reason: string } | null;
}

export interface LifeSummaryModel {
  readonly landed: readonly string[];
  readonly dodged: number;
  readonly medPct: string;
  readonly streak: number;
  readonly goalText: string;
  readonly metGoal: boolean;
  readonly battle: { readonly due: boolean; readonly line: string };
  /** How the body went this week: symptoms and the doctor visit. */
  readonly notes: readonly string[];
}

export interface LifePanelModel {
  readonly title: string;
  readonly over: boolean;
  readonly goal: {
    readonly points: number;
    readonly planned: number;
    readonly target: number;
  };
  readonly energy: {
    readonly now: number;
    readonly end: number;
    readonly max: number;
  };
  readonly meds: {
    readonly level: number;
    readonly pct: string;
    readonly streak: number;
    /** What the day's dose button should offer. */
    readonly dose: "open" | "taken" | "skipped" | "lost" | "over";
    readonly strip: readonly DoseCell[];
    readonly note: string;
  };
  readonly hint: string;
  readonly restSelected: boolean;
  readonly hand: readonly LifeCardModel[];
  readonly grid: readonly (readonly LifeSlotModel[])[];
  readonly odds: string;
  readonly beats: readonly {
    readonly day: string;
    readonly lines: readonly string[];
  }[];
  readonly summary: LifeSummaryModel | null;
  readonly playLabel: string;
  /** How you feel this week, in plain words; the nudge is a gentle pointer to the doctor card. */
  readonly feel: {
    readonly lines: readonly string[];
    readonly nudge: string | null;
  };
  /** The button that ends a finished week: the battle, or on to the next beat. */
  readonly endLabel: string;
  /** Standalone debug entry only: replan the same week. */
  readonly canAgain: boolean;
}

export interface LifePanelHandlers {
  onHelp(): void;
  onPickCard(base: string): void;
  onPickRest(): void;
  onSwap(base: string): void;
  onPills(base: string, packed: boolean): void;
  onSlot(day: number, slot: number): void;
  onTakeMeds(): void;
  onSkipMeds(): void;
  onPlay(): void;
  onStartBattle(): void;
  onAgain(): void;
  /** A card is hovered or focused (null: left). Preview only; no re-render. */
  onPreview(version: string | null): void;
}

export interface LifePanel {
  update(model: LifePanelModel): void;
  /** Scrolls the calendar to the top of the panel (a card was just picked on a phone). */
  showCalendar(): void;
}

const PANEL = "background:#262a33;border:1px solid #3a3f4a;border-radius:6px;";
const MINT = "#5be3c6";

export function createLifePanel(
  mounts: HudMounts,
  h: LifePanelHandlers,
): LifePanel {
  const el = (tag: string, css = "", text = "") => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  };
  const button = (
    text: string,
    onClick: () => void,
    css = "",
    key = "",
  ): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText = "min-height:44px;min-width:44px;padding:0 14px;" + css;
    if (key) b.dataset.key = key;
    b.addEventListener("click", onClick);
    return b;
  };
  const meter = (
    label: string,
    value: string,
    fill: number,
    ghost: number,
    color: string,
    desc: string,
  ) => {
    const box = el("div", "display:flex;flex-direction:column;gap:3px;");
    const head = el(
      "div",
      "display:flex;justify-content:space-between;font-size:13px;",
    );
    head.append(el("span", "font-weight:600;", label), el("span", "", value));
    const track = el(
      "div",
      "position:relative;height:10px;border-radius:5px;background:#3a3f4a;overflow:hidden;",
    );
    track.setAttribute("role", "img");
    track.setAttribute("aria-label", desc);
    track.append(
      el(
        "div",
        `position:absolute;inset:0 auto 0 0;width:${Math.min(1, ghost) * 100}%;background:${color};opacity:0.35;`,
      ),
      el(
        "div",
        `position:absolute;inset:0 auto 0 0;width:${Math.min(1, fill) * 100}%;background:${color};`,
      ),
    );
    box.append(head, track);
    return box;
  };

  const top = el(
    "div",
    PANEL +
      "padding:4px 4px 4px 10px;min-height:44px;box-sizing:border-box;display:flex;align-items:center;font-size:15px;",
  );
  const title = el("span", "font-weight:600;");
  const help = button("?", h.onHelp, "margin-left:auto;font-weight:700;");
  help.setAttribute("aria-label", "How to play");
  help.title = "How to play";
  top.append(title, help);

  const metersBox = el(
    "div",
    PANEL + "padding:8px 10px;display:flex;flex-direction:column;gap:8px;",
  );
  const medsBox = el(
    "div",
    PANEL + "padding:8px 10px;display:flex;flex-direction:column;gap:6px;",
  );
  const calBox = el(
    "div",
    PANEL + "padding:8px 10px;display:flex;flex-direction:column;gap:6px;",
  );
  const feelBox = el(
    "div",
    "background:#2f2a22;border:1px solid #6b5a3a;border-radius:6px;padding:8px 10px;" +
      "display:flex;flex-direction:column;gap:4px;font-size:14px;line-height:1.35;",
  );
  feelBox.setAttribute("role", "status");
  const handBox = el("div", "display:flex;flex-direction:column;gap:8px;");
  const beatsBox = el("details", PANEL) as HTMLDetailsElement;
  beatsBox.open = true;
  const beatsBody = el(
    "div",
    "padding:0 10px 10px;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.35;",
  );
  beatsBody.setAttribute("aria-live", "polite");
  beatsBox.append(
    el(
      "summary",
      "min-height:44px;display:flex;align-items:center;padding:0 10px;cursor:pointer;font-weight:600;",
      "What happened",
    ),
    beatsBody,
  );
  const key = el("details", PANEL) as HTMLDetailsElement;
  key.open = window.matchMedia("(min-width: 900px)").matches;
  key.append(
    el(
      "summary",
      "min-height:44px;display:flex;align-items:center;padding:0 10px;cursor:pointer;font-weight:600;",
      "Key",
    ),
  );
  const keyBody = el(
    "div",
    "padding:0 10px 10px;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.35;",
  );
  const dot = (css: string) => {
    const d = el(
      "span",
      `display:inline-block;width:14px;height:14px;flex:none;${css}`,
    );
    d.setAttribute("aria-hidden", "true");
    return d;
  };
  const keyRow = (mark: HTMLElement, text: string) => {
    const r = el("div", "display:flex;gap:8px;align-items:center;");
    r.append(mark, text);
    return r;
  };
  keyBody.append(
    keyRow(
      dot(`border-radius:50%;background:${MINT};box-shadow:0 0 6px ${MINT};`),
      "Green glow around the body: your medication. It fades when a dose is missed.",
    ),
    keyRow(
      dot("border-radius:50%;background:#e8a33d;"),
      "Round orange dots drifting in: bacteria. More dots, better odds of an exposure.",
    ),
    keyRow(
      dot(
        "background:#6f4fb8;clip-path:polygon(50% 0,62% 30%,100% 50%,62% 70%,50% 100%,38% 70%,0 50%,38% 30%);",
      ),
      "Violet spiky dots: mold. A pale ring around a dot means it is sealed in a shell.",
    ),
    keyRow(
      dot("border-radius:50%;border:2px dashed #b9a7e8;"),
      "Rings on the body: something the doctor found that is still there.",
    ),
  );
  key.append(keyBody);

  mounts.scroll.append(
    top,
    feelBox,
    metersBox,
    medsBox,
    calBox,
    handBox,
    beatsBox,
    key,
  );

  const playBtn = button(
    "",
    h.onPlay,
    "min-height:52px;width:100%;font-weight:700;font-size:16px;",
    "play",
  );
  const battleBtn = button(
    "Start the battle",
    h.onStartBattle,
    "min-height:52px;width:100%;font-weight:700;font-size:16px;",
    "battle",
  );
  const againBtn = button(
    "Plan this week again",
    h.onAgain,
    "min-height:52px;width:100%;font-weight:700;font-size:16px;",
    "again",
  );
  mounts.bar.append(playBtn, battleBtn, againBtn);

  const activeKey = () =>
    (document.activeElement as HTMLElement | null)?.dataset?.key ?? null;

  function renderMeters(m: LifePanelModel) {
    metersBox.replaceChildren(
      meter(
        "Goal",
        `${m.goal.points} / ${m.goal.target} points` +
          (m.goal.planned > m.goal.points
            ? ` (${m.goal.planned} planned)`
            : ""),
        m.goal.points / m.goal.target,
        m.goal.planned / m.goal.target,
        "#f0c05a",
        `Goal: ${m.goal.points} of ${m.goal.target} points, ${m.goal.planned} planned`,
      ),
      meter(
        "Energy (a game resource)",
        `${m.energy.now} / ${m.energy.max}` +
          (m.energy.end !== m.energy.now ? ` → ${m.energy.end}` : ""),
        m.energy.now / m.energy.max,
        m.energy.end / m.energy.max,
        "#9fd8f0",
        `Energy: ${m.energy.now} of ${m.energy.max}, ${m.energy.end} left after the plan`,
      ),
    );
  }

  function renderMeds(m: LifePanelModel) {
    const { meds } = m;
    const head = el(
      "div",
      "display:flex;justify-content:space-between;font-weight:600;font-size:14px;",
    );
    head.append(
      el("span", "", "Medication"),
      el(
        "span",
        "font:12px monospace;",
        `level ${meds.pct}  ·  streak ${meds.streak}`,
      ),
    );
    const strip = el("div", "display:flex;gap:6px;");
    for (const c of meds.strip) {
      const cell = el(
        "div",
        `flex:1 1 0;min-width:0;border-radius:6px;padding:4px 6px;font-size:12px;line-height:1.25;box-sizing:border-box;` +
          (c.taken
            ? `border:1px solid ${MINT};background:rgba(91,227,198,${c.decided ? 0.18 : 0.06});`
            : "border:1px dashed #d9a35c;background:rgba(217,163,92,0.14);"),
      );
      cell.append(
        el(
          "div",
          "font-weight:600;",
          `Day ${c.day + 1} ${c.taken ? "✓" : "✗"}`,
        ),
        el("div", "opacity:0.85;", c.why),
        el("div", "opacity:0.7;", `→ ${Math.round(c.level * 100)}%`),
      );
      strip.append(cell);
    }
    medsBox.replaceChildren(head, strip);
    if (meds.note) {
      medsBox.append(
        el("div", "font-size:12px;opacity:0.85;line-height:1.3;", meds.note),
      );
    }
    if (meds.dose === "open") {
      const row = el("div", "display:flex;gap:6px;");
      row.append(
        button(
          "Take meds",
          h.onTakeMeds,
          `flex:1 1 auto;font-weight:700;border-color:${MINT};`,
          "meds",
        ),
        button(
          "Skip today",
          h.onSkipMeds,
          "flex:0 0 auto;opacity:0.85;",
          "skip",
        ),
      );
      medsBox.append(row);
    } else {
      const text = {
        taken: "Today's meds are taken.",
        skipped: "Today's dose is skipped.",
        lost: "Today's dose is missed: the pills are in the other bag.",
        over: "",
      }[meds.dose];
      if (text) medsBox.append(el("div", "font-size:13px;", text));
    }
  }

  function renderCalendar(m: LifePanelModel) {
    calBox.replaceChildren(
      el("div", "font-weight:600;font-size:14px;", "Your week"),
    );
    const hint = el(
      "div",
      "font-size:13px;line-height:1.3;min-height:1.3em;",
      m.hint,
    );
    hint.setAttribute("aria-live", "polite");
    calBox.append(hint);
    const grid = el(
      "div",
      "display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;",
    );
    // Columns are days; rows are slots.
    const rows = m.grid[0].length;
    for (let slot = 0; slot < rows; slot++) {
      for (const day of m.grid) {
        const s = day[slot];
        const blocked = s.target !== null && !s.target.ok;
        const live = s.target?.ok === true;
        const b = button(
          "",
          () => h.onSlot(s.day, s.slot),
          "display:flex;flex-direction:column;gap:2px;align-items:flex-start;justify-content:flex-start;" +
            "text-align:left;padding:6px 7px;min-height:76px;font-size:12px;line-height:1.25;overflow:hidden;" +
            (live ? `border-color:${MINT};box-shadow:0 0 0 1px ${MINT};` : "") +
            (blocked ? "opacity:0.5;border-style:dashed;" : "") +
            (s.today ? "background:#303744;" : ""),
          `slot-${s.day}-${s.slot}`,
        );
        const name = `Day ${s.day + 1} ${s.name.toLowerCase()}`;
        b.append(
          el("span", "opacity:0.7;font-size:11px;", `${s.day + 1} · ${s.name}`),
        );
        if (s.card) {
          b.append(
            el("span", "font-weight:600;", s.card.label),
            el("span", "opacity:0.8;", `+${s.card.points} pts`),
          );
          if (s.card.pills) {
            b.append(
              el(
                "span",
                "opacity:0.8;",
                s.card.pills === "packed"
                  ? "pills packed"
                  : "pills left behind",
              ),
            );
          }
        } else {
          b.append(el("span", "opacity:0.7;", "Rest (+1 energy)"));
        }
        if (blocked && s.target) {
          b.append(el("span", "color:#e8c68f;", s.target.reason));
        }
        b.disabled = s.played || blocked;
        b.setAttribute(
          "aria-label",
          `${name}: ${s.card ? s.card.label : "rest"}` +
            (s.played ? ", played" : "") +
            (blocked && s.target ? `, ${s.target.reason}` : "") +
            (s.card && !s.played ? ", tap to remove" : ""),
        );
        if (s.played) b.style.opacity = "0.6";
        grid.append(b);
      }
    }
    calBox.append(
      grid,
      el("div", "font-size:12px;opacity:0.85;line-height:1.3;", m.odds),
    );
  }

  function renderHand(m: LifePanelModel) {
    handBox.replaceChildren();
    for (const c of m.hand) {
      const box = el(
        "div",
        PANEL +
          "padding:8px 10px;display:flex;flex-direction:column;gap:6px;" +
          (c.selected
            ? `border-color:${MINT};box-shadow:0 0 0 1px ${MINT};`
            : "") +
          (c.played ? "opacity:0.55;" : ""),
      );
      const pick = button(
        "",
        () => h.onPickCard(c.base),
        "display:flex;flex-direction:column;gap:3px;align-items:flex-start;text-align:left;padding:8px 10px;border:0;background:transparent;width:100%;",
        `card-${c.base}`,
      );
      pick.disabled = c.played;
      pick.setAttribute("aria-pressed", String(c.selected));
      pick.append(
        el("span", "font-weight:700;font-size:15px;", c.label),
        el("span", "line-height:1.3;", c.people),
        ...(c.doctor
          ? c.doctor.map((t) =>
              el("span", "font-size:13px;opacity:0.9;line-height:1.3;", t),
            )
          : [
              el(
                "span",
                "font-size:13px;opacity:0.8;line-height:1.3;",
                c.blurb,
              ),
              el(
                "span",
                "font-size:13px;display:flex;gap:10px;flex-wrap:wrap;",
                `+${c.points} points · ${c.energy} energy`,
              ),
              el("span", "font-size:13px;font-weight:600;", c.odds),
            ]),
        el(
          "span",
          "font-size:12px;opacity:0.75;",
          c.played
            ? "Played."
            : c.placedAt
              ? `On your calendar: ${c.placedAt}`
              : "",
        ),
      );
      pick.addEventListener("pointerenter", () => h.onPreview(c.version));
      pick.addEventListener("pointerleave", () => h.onPreview(null));
      pick.addEventListener("focus", () => h.onPreview(c.version));
      pick.addEventListener("blur", () => h.onPreview(null));
      box.append(pick);
      if (c.alt && !c.played) {
        const alt = button(
          c.alt.text,
          () => h.onSwap(c.base),
          "text-align:left;padding:6px 10px;font-size:13px;min-height:44px;",
          `swap-${c.base}`,
        );
        alt.append(el("span", "display:block;opacity:0.8;", c.alt.odds));
        alt.addEventListener("pointerenter", () =>
          h.onPreview(c.alt?.version ?? null),
        );
        alt.addEventListener("pointerleave", () => h.onPreview(null));
        box.append(alt);
      }
      if (c.pills && !c.played) {
        const row = el(
          "label",
          "display:flex;gap:8px;align-items:center;min-height:44px;font-size:13px;line-height:1.3;",
        );
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = c.pills.packed;
        cb.dataset.key = `pills-${c.base}`;
        cb.style.cssText = "width:22px;height:22px;margin:0;flex:none;";
        cb.addEventListener("change", () => h.onPills(c.base, cb.checked));
        row.append(
          cb,
          c.pills.packed
            ? `Pills packed (costs ${c.pills.extra} more energy). Tomorrow's dose is safe.`
            : `Pack the pills (costs ${c.pills.extra} more energy). Otherwise tomorrow's dose is missed.`,
        );
        box.append(row);
      }
      handBox.append(box);
    }
    const rest = button(
      "",
      h.onPickRest,
      `text-align:left;padding:8px 12px;display:flex;flex-direction:column;gap:2px;align-items:flex-start;` +
        (m.restSelected
          ? `border-color:${MINT};box-shadow:0 0 0 1px ${MINT};`
          : ""),
      "rest",
    );
    rest.setAttribute("aria-pressed", String(m.restSelected));
    rest.append(
      el("span", "font-weight:700;font-size:15px;", "Rest"),
      el(
        "span",
        "font-size:13px;opacity:0.8;line-height:1.3;",
        "Take a slot off: +1 energy, no exposure. Tap a slot to clear it.",
      ),
    );
    handBox.append(rest);
  }

  function renderSummary(s: LifeSummaryModel) {
    handBox.replaceChildren();
    const box = el(
      "div",
      PANEL +
        "padding:10px 12px;display:flex;flex-direction:column;gap:6px;line-height:1.4;",
    );
    box.append(
      el("div", "font-weight:700;font-size:16px;", "The week in review"),
      el("div", "", `Goal: ${s.goalText}${s.metGoal ? " You made it." : ""}`),
      el("div", "", `Medication level: ${s.medPct} (streak ${s.streak}).`),
    );
    for (const n of s.notes) box.append(el("div", "", n));
    if (s.landed.length > 0) {
      box.append(el("div", "font-weight:600;", "What landed"));
      for (const t of s.landed) box.append(el("div", "", `• ${t}`));
    } else {
      box.append(el("div", "", "No exposures landed."));
    }
    if (s.dodged > 0) {
      box.append(
        el(
          "div",
          "opacity:0.85;",
          `${s.dodged} roll${s.dodged > 1 ? "s" : ""} came up clear.`,
        ),
      );
    }
    box.append(
      el(
        "div",
        `font-weight:600;padding-top:4px;color:${s.battle.due ? "#e4e7ee" : MINT};`,
        s.battle.line,
      ),
    );
    handBox.append(box);
  }

  return {
    showCalendar() {
      calBox.scrollIntoView({ block: "start" });
    },
    update(m) {
      const focus = activeKey();
      title.textContent = m.title;
      feelBox.style.display = m.feel.lines.length > 0 ? "flex" : "none";
      feelBox.replaceChildren(
        el("div", "font-weight:700;", "How you feel"),
        ...m.feel.lines.map((t) => el("div", "", t)),
        ...(m.feel.nudge
          ? [el("div", "font-size:13px;opacity:0.85;", m.feel.nudge)]
          : []),
      );
      renderMeters(m);
      renderMeds(m);
      renderCalendar(m);
      if (m.over && m.summary) renderSummary(m.summary);
      else renderHand(m);
      beatsBody.replaceChildren();
      if (m.beats.length === 0) {
        beatsBody.append(
          el("div", "opacity:0.7;", "Play a day to see what happens."),
        );
      }
      for (const b of m.beats) {
        beatsBody.append(el("div", "font-weight:600;", b.day));
        for (const l of b.lines) beatsBody.append(el("div", "", l));
      }
      playBtn.style.display = m.over ? "none" : "";
      playBtn.textContent = m.playLabel;
      battleBtn.style.display = m.over && m.endLabel ? "" : "none";
      battleBtn.textContent = m.endLabel;
      againBtn.style.display = m.over && m.canAgain ? "" : "none";
      if (focus) {
        const target = mounts.scroll.parentElement?.querySelector<HTMLElement>(
          `[data-key="${focus}"]`,
        );
        if (target && !(target as HTMLButtonElement).disabled) target.focus();
      }
    },
  };
}
