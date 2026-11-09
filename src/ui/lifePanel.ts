import type { DoseCell } from "../app/lifeModel";
import type { HudMounts } from "./hud";
import { cardAccent, cardBadge, cardTint } from "./cardStyle";
import { createInfoTips } from "./infoTip";
import { organismKeyText } from "../sim/organisms";
import { PATHOGEN_KINDS } from "../sim/pathogens";
import { GERM_COLOR_WORD as KEY_COLOR } from "./hud";

// The calendar screen's side panel. Views are read-only: the app builds a LifePanelModel from the
// life state and passes handlers back; the panel never touches sim state.

export interface LifeCardModel {
  readonly base: string;
  readonly version: string;
  readonly label: string;
  readonly people: string;
  readonly blurb: string;
  /** "+4 points, -2 energy, +40 score": what this version costs and adds. */
  readonly facts: string;
  readonly odds: string;
  readonly chance: number;
  /** A late-night card: its risk to that day's pills, in words. Null otherwise. */
  readonly doseRisk: string | null;
  /** The other version, offered as an easy swap. */
  readonly alt: {
    readonly version: string;
    readonly text: string;
    /** Odds, then the same facts line as the card face. */
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
    readonly version: string;
    readonly label: string;
    readonly points: number;
    readonly pills: "packed" | "left" | null;
  } | null;
  readonly played: boolean;
  readonly today: boolean;
  /** Chosen first, waiting for an activity. */
  readonly pending: boolean;
  /** While an activity is picked: can it go here, and why not. */
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
  readonly meds: {
    readonly level: number;
    readonly streak: number;
    readonly strip: readonly DoseCell[];
    readonly note: string;
  };
  /** What to do next while something is picked, or why a move was refused; empty when idle. */
  readonly hint: string;
  /** How the planner works, behind the (?) beside "Your week". */
  readonly help: string;
  readonly restSelected: boolean;
  readonly hand: readonly LifeCardModel[];
  readonly grid: readonly (readonly LifeSlotModel[])[];
  readonly beats: readonly {
    readonly day: string;
    readonly lines: readonly string[];
  }[];
  readonly summary: LifeSummaryModel | null;
  readonly playLabel: string;
  /** The one-day button's label, or null when only one day is left (the week button does it). */
  readonly playDayLabel: string | null;
  /** How you feel this week, in plain words; the nudge is a gentle pointer to the doctor card. */
  readonly feel: {
    readonly lines: readonly string[];
    readonly nudge: string | null;
  };
  /** Why the week stopped playing, with the choices that are open right now; null when none. */
  readonly banner: {
    readonly text: string;
    readonly canBook: boolean;
    /** Why booking could not happen, shown under the text. */
    readonly note: string;
  } | null;
  /** A lost skirmish's aftermath: flavor, not a symptom. */
  readonly aftermath: { readonly title: string; readonly text: string } | null;
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
  /** Plays the rest of the week, stopping on a symptom or when the week ends. */
  onPlay(): void;
  /** The stop banner's [Play on]: carries on with the week. */
  onPlayOn(): void;
  /** The stop banner's [Book the doctor]. */
  onBookDoctor(): void;
  /** Plays just today. */
  onPlayDay(): void;
  onStartBattle(): void;
  onAgain(): void;
  /** An activity is hovered or focused (null: left). Preview only; no re-render. */
  onPreview(version: string | null): void;
}

export interface LifePanel {
  update(model: LifePanelModel): void;
}

const PANEL =
  "background:var(--zw-raised);border:1px solid var(--zw-line);border-radius:6px;";
const MINT = "var(--zw-med)";

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
  const tip = createInfoTips();
  const PHONE = window.matchMedia(
    "(max-width: 899px) and (max-aspect-ratio: 5/4) and (min-height: 501px)",
  );
  const ROW =
    "display:flex;align-items:center;justify-content:space-between;gap:6px;";
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
    "background:var(--zw-notice-bg);border:1px solid var(--zw-notice-line);border-radius:6px;padding:8px 10px;" +
      "display:flex;flex-direction:column;gap:4px;font-size:14px;line-height:1.35;",
  );
  feelBox.setAttribute("role", "status");
  const aftermathBox = el(
    "div",
    "background:var(--zw-info-bg);border:1px dashed var(--zw-swarm-loaded);border-radius:6px;padding:8px 10px;" +
      "display:flex;flex-direction:column;gap:2px;font-size:13px;line-height:1.35;color:var(--zw-text);",
  );
  aftermathBox.setAttribute("role", "status");
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
  const keyTip = tip(
    "life-key",
    "The glow fades when a dose is missed. More orange dots mean better odds of an exposure. A pale ring always means a shell.",
    "the key",
  );
  keyBody.append(
    el("div", ROW + "font-size:12px;opacity:0.85;", "Good to know"),
    keyRow(
      dot(`border-radius:50%;background:${MINT};box-shadow:0 0 6px ${MINT};`),
      "Green glow: your medication",
    ),
    ...(["strep", "staph", "aspergillus"] as const).map((id) => {
      const def = PATHOGEN_KINDS[id];
      const body =
        def.form === "mold"
          ? `background:var(--zw-${id});clip-path:polygon(50% 0,62% 30%,100% 50%,62% 70%,50% 100%,38% 70%,0 50%,38% 30%);`
          : `border-radius:50%;background:var(--zw-${id});`;
      const sealed = def.wall === "sealed";
      return keyRow(
        dot(
          body +
            (sealed
              ? "outline:2px solid var(--zw-sealed-rim);outline-offset:1px;"
              : ""),
        ),
        `${KEY_COLOR[id]} ${def.form === "mold" ? "spiky" : "round"} dots${sealed ? " with a ring" : ""}: ${organismKeyText(id)}${sealed ? " in a shell" : ""}`,
      );
    }),
    keyRow(
      dot("border-radius:50%;border:2px dashed var(--zw-aspergillus-ink);"),
      "Dashed ring: found by the doctor, still there",
    ),
    keyTip.note,
  );
  keyBody.firstElementChild?.append(keyTip.button);
  key.append(keyBody);

  mounts.scroll.append(
    top,
    aftermathBox,
    feelBox,
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
  const playDayBtn = button(
    "",
    h.onPlayDay,
    "min-height:44px;width:100%;font-size:14px;",
    "play-day",
  );
  const battleBtn = button(
    "",
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
  const bannerBox = el(
    "div",
    PANEL +
      "padding:8px 10px;display:none;flex-direction:column;gap:6px;font-size:13px;line-height:1.3;",
  );
  bannerBox.setAttribute("role", "status");
  bannerBox.setAttribute("aria-live", "polite");
  bannerBox.dataset.key = "banner";
  const bookBtn = button(
    "Book the doctor",
    h.onBookDoctor,
    "min-height:44px;flex:1 1 0;font-size:14px;font-weight:600;",
    "banner-book",
  );
  const playOnBtn = button(
    "Play on",
    h.onPlayOn,
    "min-height:44px;flex:1 1 0;font-size:14px;font-weight:600;",
    "banner-play-on",
  );
  mounts.bar.append(bannerBox, playBtn, playDayBtn, battleBtn, againBtn);

  const activeKey = () =>
    (document.activeElement as HTMLElement | null)?.dataset?.key ?? null;

  function renderMeds(m: LifePanelModel) {
    const { meds } = m;
    const head = el(
      "div",
      "display:flex;justify-content:space-between;font-weight:600;font-size:14px;",
    );
    head.append(
      el("span", "", "Medication"),
      el("span", "font:12px monospace;", `streak ${meds.streak}`),
    );
    const strip = el("div", "display:flex;gap:6px;");
    // Read-only forecast cells: no handler can skip a dose, the routine either holds or life
    // breaks it (see doseStrip).
    for (const c of meds.strip) {
      const css =
        `flex:1 1 0;min-width:0;border-radius:6px;padding:4px 6px;font-size:12px;line-height:1.25;box-sizing:border-box;` +
        `text-align:left;min-height:44px;` +
        (c.taken
          ? `border:1px solid ${MINT};background:rgba(91,227,198,${c.decided ? 0.18 : 0.06});`
          : "border:1px dashed var(--zw-notice);background:rgba(217,163,92,0.14);");
      const cell = el("div", css);
      const mark = c.glyph === "check" ? "✓" : c.glyph === "alert" ? "!" : "✗";
      const word =
        c.chance === null ? c.why : `${c.why} ${Math.round(c.chance * 100)}%`;
      cell.append(
        el("div", "font-weight:600;", `Day ${c.day + 1} ${mark}`),
        el("div", "opacity:0.85;", word),
        el("div", "opacity:0.7;", `${Math.round(c.level * 100)}%`),
      );
      cell.setAttribute("role", "group");
      cell.setAttribute("aria-label", c.label);
      strip.append(cell);
    }
    medsBox.replaceChildren(head, strip);
    if (meds.note) {
      medsBox.append(
        el("div", "font-size:12px;opacity:0.85;line-height:1.3;", meds.note),
      );
    }
  }

  function renderCalendar(m: LifePanelModel) {
    // Phone portrait with something picked: the calendar pins itself to the top of the scroll
    // area, compact, so the activity list (and its easier version) stays reachable below it
    // without any scrolling back and forth.
    const picked =
      m.restSelected ||
      m.hand.some((c) => c.selected) ||
      m.grid.some((d) => d.some((s) => s.pending));
    const pinned = picked && !m.over && PHONE.matches;
    calBox.style.cssText =
      PANEL +
      "padding:8px 10px;display:flex;flex-direction:column;gap:6px;" +
      (pinned
        ? "position:sticky;top:0;z-index:1;box-shadow:0 4px 8px rgba(0,0,0,0.35);"
        : "");
    const head = el("div", ROW);
    head.append(el("span", "font-weight:600;font-size:14px;", "Your week"));
    const planTip = tip("life-plan", m.help, "planning your week");
    head.append(planTip.button);
    calBox.replaceChildren(head, planTip.note);
    const hint = el("div", "font-size:13px;line-height:1.3;", m.hint);
    hint.setAttribute("aria-live", "polite");
    hint.style.display = m.hint ? "" : "none";
    calBox.append(hint);
    const grid = el(
      "table",
      "width:100%;table-layout:fixed;border-collapse:separate;border-spacing:6px;margin:-6px;width:calc(100% + 12px);",
    );
    grid.setAttribute(
      "aria-label",
      "Your week: three days, daytime and evening",
    );
    const headRow = el("tr");
    headRow.append(el("td", "width:62px;"));
    m.grid.forEach((_, i) => {
      const th = el(
        "th",
        "font-size:13px;font-weight:700;text-align:center;padding:2px 0;",
        `Day ${i + 1}`,
      );
      th.setAttribute("scope", "col");
      headRow.append(th);
    });
    const thead = el("thead");
    thead.append(headRow);
    const tbody = el("tbody");
    // Columns are days; rows are time slots.
    const rows = m.grid[0].length;
    for (let slot = 0; slot < rows; slot++) {
      const tr = el("tr");
      const rowHead = el(
        "th",
        "font-size:12px;font-weight:600;text-align:left;vertical-align:middle;padding:0;",
        m.grid[0][slot].name,
      );
      rowHead.setAttribute("scope", "row");
      tr.append(rowHead);
      for (const day of m.grid) {
        const s = day[slot];
        const blocked = s.target !== null && !s.target.ok;
        const live = s.target?.ok === true;
        const td = el("td", "padding:0;vertical-align:top;");
        const b = button(
          "",
          () => h.onSlot(s.day, s.slot),
          `display:flex;flex-direction:column;gap:2px;align-items:flex-start;justify-content:flex-start;` +
            `text-align:left;padding:5px 5px 5px 6px;min-height:${pinned ? 56 : 76}px;min-width:0;width:100%;box-sizing:border-box;font-size:12px;line-height:1.25;overflow:hidden;overflow-wrap:break-word;hyphens:manual;word-break:normal;` +
            (live ? `border-color:${MINT};box-shadow:0 0 0 1px ${MINT};` : "") +
            (s.pending
              ? `border:2px solid ${MINT};box-shadow:0 0 0 2px ${MINT};background:rgba(91,227,198,0.16);`
              : "") +
            (blocked ? "opacity:0.5;border-style:dashed;" : "") +
            (s.today && !s.pending ? "background:var(--zw-control);" : ""),
          `slot-${s.day}-${s.slot}`,
        );
        const name = `Day ${s.day + 1} ${s.name.toLowerCase()}`;
        if (s.card) {
          b.style.background = `var(--zw-${cardTint(s.card.version)})`;
          b.style.borderLeft = `6px solid var(--zw-${cardAccent(s.card.version)})`;
          b.append(
            cardBadge(s.card.version, 24),
            el(
              "span",
              "font-weight:600;min-width:0;max-width:100%;overflow-wrap:break-word;hyphens:manual;",
              s.card.label,
            ),
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
        } else if (s.pending) {
          b.append(el("span", "font-weight:700;", "Chosen"));
        } else {
          b.append(el("span", "opacity:0.7;", "Rest (+1 energy)"));
        }
        if (blocked && s.target) {
          b.append(el("span", "color:var(--zw-goal);", s.target.reason));
        }
        b.disabled = s.played || blocked;
        b.setAttribute("aria-pressed", String(s.pending));
        b.setAttribute(
          "aria-label",
          `${name}: ${s.card ? s.card.label : "rest"}` +
            (s.pending ? ", chosen, now pick an activity" : "") +
            (s.played ? ", played" : "") +
            (blocked && s.target ? `, ${s.target.reason}` : "") +
            (s.card && !s.played ? ", tap to remove" : ""),
        );
        if (s.played) b.style.opacity = "0.6";
        td.append(b);
        tr.append(td);
      }
      tbody.append(tr);
    }
    grid.append(thead, tbody);
    calBox.append(grid);
  }

  function renderHand(m: LifePanelModel) {
    handBox.replaceChildren();
    for (const c of m.hand) {
      const box = el(
        "div",
        PANEL +
          "padding:8px 10px;display:flex;flex-direction:column;gap:6px;" +
          `background:var(--zw-${cardTint(c.version)});` +
          (c.selected
            ? `border-color:${MINT};box-shadow:0 0 0 1px ${MINT};`
            : "") +
          `border-left:6px solid var(--zw-${cardAccent(c.version)});` +
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
        ...(c.doctor
          ? c.doctor.map((t) =>
              el("span", "font-size:13px;opacity:0.9;line-height:1.3;", t),
            )
          : [
              el("span", "font-size:13px;", c.facts),
              el("span", "font-size:13px;font-weight:600;", c.odds),
              ...(c.doseRisk
                ? [
                    el(
                      "span",
                      "font-size:13px;font-weight:600;color:var(--zw-notice);",
                      `! ${c.doseRisk}`,
                    ),
                  ]
                : []),
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
      const cardTip = tip(
        `card-${c.base}`,
        [c.people, c.blurb].filter(Boolean).join(" "),
        c.label,
      );
      const cardRow = el("div", "display:flex;align-items:flex-start;gap:2px;");
      pick.style.flex = "1 1 auto";
      pick.style.width = "auto";
      pick.style.minWidth = "0";
      const badge = cardBadge(c.version);
      badge.style.marginTop = "8px";
      cardRow.append(badge, pick, cardTip.button);
      box.append(cardRow, cardTip.note);
      if (c.alt && !c.played) {
        const alt = button(
          "",
          () => h.onSwap(c.base),
          "text-align:left;padding:6px 10px;font-size:13px;min-height:44px;display:flex;align-items:center;gap:8px;" +
            `background:var(--zw-${cardTint(c.alt.version)});border-left:6px solid var(--zw-${cardAccent(c.alt.version)});`,
          `swap-${c.base}`,
        );
        const altText = el("span", "min-width:0;", c.alt.text);
        altText.append(el("span", "display:block;opacity:0.8;", c.alt.odds));
        alt.append(cardBadge(c.alt.version, 24), altText);
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
            ? `Pills packed (-${c.pills.extra} energy)`
            : `Pack the pills (-${c.pills.extra} energy), or tomorrow's dose is missed`,
        );
        box.append(row);
      }
      handBox.append(box);
    }
    const rest = button(
      "",
      h.onPickRest,
      `text-align:left;padding:8px 12px;display:flex;flex-direction:row;gap:10px;align-items:center;` +
        `background:var(--zw-card-rest-bg);border-left:6px solid var(--zw-card-rest);` +
        (m.restSelected
          ? `border-color:${MINT};box-shadow:0 0 0 1px ${MINT};`
          : ""),
      "rest",
    );
    rest.setAttribute("aria-pressed", String(m.restSelected));
    const restText = el("span", "display:flex;flex-direction:column;gap:2px;");
    restText.append(
      el("span", "font-weight:700;font-size:15px;", "Rest"),
      el(
        "span",
        "font-size:13px;opacity:0.8;line-height:1.3;",
        "+1 energy, no exposure",
      ),
    );
    rest.append(cardBadge("rest"), restText);
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
        `font-weight:600;padding-top:4px;color:${s.battle.due ? "var(--zw-text)" : MINT};`,
        s.battle.line,
      ),
    );
    handBox.append(box);
  }

  return {
    update(m) {
      const focus = activeKey();
      title.textContent = m.title;
      aftermathBox.style.display = m.aftermath ? "flex" : "none";
      aftermathBox.replaceChildren(
        ...(m.aftermath
          ? [
              el("div", "font-weight:600;", m.aftermath.title),
              el("div", "font-size:12px;opacity:0.9;", m.aftermath.text),
            ]
          : []),
      );
      feelBox.style.display = m.feel.lines.length > 0 ? "flex" : "none";
      feelBox.replaceChildren(
        el("div", "font-weight:700;", "How you feel"),
        ...m.feel.lines.map((t) => el("div", "", t)),
        ...(m.feel.nudge
          ? [el("div", "font-size:13px;opacity:0.85;", m.feel.nudge)]
          : []),
      );
      bannerBox.style.display = m.banner ? "flex" : "none";
      if (m.banner) {
        const buttons = el("div", "display:flex;gap:8px;");
        buttons.append(
          ...(m.banner.canBook ? [bookBtn, playOnBtn] : [playOnBtn]),
        );
        bannerBox.replaceChildren(
          el("div", "", m.banner.text),
          ...(m.banner.note
            ? [el("div", "color:var(--zw-goal);", m.banner.note)]
            : []),
          buttons,
        );
      } else bannerBox.replaceChildren();
      renderMeds(m);
      renderCalendar(m);
      if (m.over && m.summary) renderSummary(m.summary);
      else renderHand(m);
      beatsBody.replaceChildren();
      if (m.beats.length === 0) {
        beatsBody.append(
          el("div", "opacity:0.7;", "Play the week to see what happens."),
        );
      }
      for (const b of m.beats) {
        beatsBody.append(el("div", "font-weight:600;", b.day));
        for (const l of b.lines) beatsBody.append(el("div", "", l));
      }
      playBtn.style.display = m.over ? "none" : "";
      playBtn.textContent = m.playLabel;
      playDayBtn.style.display = m.over || !m.playDayLabel ? "none" : "";
      playDayBtn.textContent = m.playDayLabel ?? "";
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
