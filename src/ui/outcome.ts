import { organismName, organismSub } from "../sim/organisms";
import type {
  BattleGrade,
  BattleKind,
  BattleOutcome,
  BattleStatus,
} from "../sim/types";

export interface OutcomeHandlers {
  onPlayAgain(): void;
  onNewSeed(): void;
  onReplay(): void;
  /** Campaign only: on to the next week (or the summary). */
  onNext?(): void;
}

/** Campaign context for the overlay: what carries into next week and what it may mean. */
export interface OutcomeExtra {
  readonly nextLabel: string;
  readonly kept: number;
  readonly dropped: number;
  readonly energyNext: number;
  readonly lastWeek: boolean;
  /** The luck line: the week's odds beside what happened. */
  readonly luck?: string;
  /** "Your plan and your routine were strong": a careful week that was still a hard fight. */
  readonly stillHard?: string;
  /** The "This week" block: Lived, Odds, Fight and Score. */
  readonly week?: readonly { readonly label: string; readonly text: string }[];
}

/** One row of Part B's before and now table. */
export interface CompareRow {
  readonly label: string;
  readonly before: string;
  readonly now: string;
}

/**
 * Arc 1's outcome card: no energy, carry or turns-played lines, the arc's own words instead of
 * the grade summary, and Part A's readings beside Part B's (or one line if Part A was skipped).
 */
export interface ArcCard {
  readonly summary?: string;
  readonly rows: readonly CompareRow[];
  /** Shown when there are no rows. */
  readonly note?: string;
}

export interface OutcomeOverlay {
  show(
    outcome: BattleOutcome,
    status: BattleStatus,
    extra?: OutcomeExtra,
    kind?: BattleKind,
    /** An arc's single battle: the Next button ends the arc under this label. */
    arcEnd?: string,
    arcCard?: ArcCard,
  ): void;
  hide(): void;
}

export const GRADE: Record<BattleGrade, { title: string; summary: string }> = {
  cleared: {
    title: "All clear",
    summary:
      "Your neutrophils cleared every germ from the board. Nothing is left to carry forward.",
  },
  contained: {
    title: "Contained",
    summary:
      "The germs are held, not gone. Anything sealed away stays with you, so keep an eye on it.",
  },
  neededBackup: {
    title: "Backup arrived",
    summary:
      "This one needed extra help, and help arrived. That is what backup is for.",
  },
};

/** A skirmish ends gently: short, warm, never frightening. */
export const SKIRMISH_COPY = {
  cleared: {
    title: "All quiet",
    summary: "All quiet again. Your body handled it.",
  },
  loose: {
    title: "Still stirring",
    summary: "Something is still stirring, you may feel worn out tomorrow.",
  },
} as const;

const ENDED = {
  noFreePathogens: "No loose germs were left.",
  maxTurns: "The turns ran out.",
} as const;

/**
 * What a full battle's heading says. A battle that ended because tissue reached the backup line
 * says "Backup arrived." with a kind line; no blame, backup is part of the plan.
 */
export function outcomeHeading(
  grade: BattleGrade,
  reason: BattleStatus["reason"],
): { title: string; summary: string } {
  if (reason === "backup") {
    return {
      title: "Backup arrived.",
      summary:
        "Your care team stepped in, which is exactly what backup is for. You did your part, and this fight is over.",
    };
  }
  return GRADE[grade];
}

const BACKUP_REASON = {
  tissue: "The tissue was worn down by heat and infection.",
  freePathogens: "Some germs were still loose when the battle ended.",
} as const;

const WHERE = {
  swarm: "still carried by a swarm",
  granuloma: "walled off in a granuloma",
  hidden: "hidden, not yet found",
} as const;

export function createOutcomeOverlay(
  root: HTMLElement,
  handlers: OutcomeHandlers,
): OutcomeOverlay {
  const backdrop = document.createElement("div");
  backdrop.style.cssText =
    "position:absolute;inset:0;display:none;align-items:center;justify-content:center;" +
    "padding:12px;box-sizing:border-box;background:rgba(14,15,19,0.6);pointer-events:auto;" +
    "font:15px sans-serif;color:var(--zw-text);";

  const card = document.createElement("div");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "outcome-title");
  card.tabIndex = -1;
  card.style.cssText =
    "background:var(--zw-raised);border:1px solid var(--zw-line-strong);border-radius:10px;padding:18px 20px;" +
    "width:min(100%,480px);max-height:100%;overflow:auto;box-sizing:border-box;" +
    "display:flex;flex-direction:column;gap:10px;";

  const title = document.createElement("h2");
  title.id = "outcome-title";
  title.style.cssText = "margin:0;font:600 24px sans-serif;";
  const summary = document.createElement("p");
  summary.style.cssText = "margin:0;line-height:1.4;";
  const reasons = document.createElement("ul");
  reasons.style.cssText = "margin:0;padding-left:20px;line-height:1.4;";
  const carry = document.createElement("div");
  const compare = document.createElement("div");
  const stats = document.createElement("p");
  stats.style.cssText = "margin:0;line-height:1.4;";
  const luck = document.createElement("p");
  luck.style.cssText = "margin:0;line-height:1.4;";
  const weekHead = document.createElement("div");
  weekHead.style.cssText = "font-weight:700;";
  weekHead.textContent = "This week";
  const week = document.createElement("div");
  week.style.cssText =
    "padding:8px 10px;border-radius:6px;background:var(--zw-control);line-height:1.4;font-size:14px;" +
    "display:flex;flex-direction:column;gap:4px;";

  const buttons = document.createElement("div");
  buttons.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;";
  const button = (text: string, onClick: () => void, primary = false) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText =
      "min-height:44px;min-width:44px;padding:0 16px;font:inherit;flex:1 1 auto;" +
      (primary ? "font-weight:700;" : "");
    b.addEventListener("click", onClick);
    return b;
  };
  const again = button("Play again (same seed)", handlers.onPlayAgain, true);
  const fresh = button("New seed", handlers.onNewSeed);
  const replay = button("Replay last turn", handlers.onReplay);
  const peek = button("Look at the board", () => setCollapsed(true));
  const next = button("Next", () => handlers.onNext?.(), true);
  buttons.append(next, again, fresh, replay, peek);
  card.append(
    title,
    summary,
    luck,
    reasons,
    compare,
    carry,
    stats,
    week,
    buttons,
  );
  backdrop.append(card);

  // A small tab to bring the card back after looking at the final board.
  const tab = button("Show results", () => setCollapsed(false), true);
  tab.style.cssText +=
    "position:absolute;left:50%;top:8px;transform:translateX(-50%);display:none;pointer-events:auto;";
  root.append(backdrop, tab);

  let open = false;
  function setCollapsed(collapsed: boolean) {
    backdrop.style.display = open && !collapsed ? "flex" : "none";
    tab.style.display = open && collapsed ? "" : "none";
    if (open && !collapsed) card.focus();
    else if (open) tab.focus();
  }

  // A tap outside the card looks at the board, like Escape.
  backdrop.addEventListener("pointerdown", (e) => {
    if (e.target === backdrop && open) setCollapsed(true);
  });

  const keys = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) setCollapsed(true);
  };
  window.addEventListener("keydown", keys);

  const meaning = (extra: OutcomeExtra) => {
    const box = document.createElement("div");
    box.style.cssText =
      "margin-top:8px;padding:8px 10px;border-radius:6px;background:var(--zw-control);line-height:1.4;font-size:14px;";
    if (extra.kept === 0) {
      box.textContent = extra.lastWeek
        ? "Nothing is left over to carry forward."
        : "Nothing is left over, so next week starts clear.";
      return box;
    }
    const lines = [
      `${extra.kept} will ride along into ${extra.lastWeek ? "the days after" : "next week"}, hidden again.`,
      "What that means: they may show up as symptoms, like a low fever, a sore spot, or feeling tired. If you notice one, the doctor can take a look.",
    ];
    if (extra.dropped > 0)
      lines.push(`${extra.dropped} more settle on their own.`);
    box.replaceChildren(
      ...lines.map((t) => {
        const p = document.createElement("div");
        p.textContent = t;
        return p;
      }),
    );
    return box;
  };

  const rows = (outcome: BattleOutcome) => {
    const head = document.createElement("div");
    head.style.cssText = "font-weight:600;margin-bottom:4px;";
    if (outcome.reservoirs.length === 0) {
      head.textContent = "Carrying forward: nothing.";
      return [head];
    }
    head.textContent = "Carrying forward";
    const list = document.createElement("ul");
    list.style.cssText = "margin:0;padding-left:20px;line-height:1.4;";
    for (const r of outcome.reservoirs) {
      const li = document.createElement("li");
      li.textContent = `${organismName(r.kind)}, size ${r.size}: ${WHERE[r.source]}`;
      const sub = document.createElement("div");
      sub.style.cssText = "font-size:12px;opacity:0.65;";
      sub.textContent = organismSub(r.kind);
      li.append(sub);
      list.append(li);
    }
    return [head, list];
  };

  const table = (card: ArcCard) => {
    if (card.rows.length === 0) {
      const p = document.createElement("p");
      p.style.cssText = "margin:0;line-height:1.4;";
      p.textContent = card.note ?? "";
      return [p];
    }
    const t = document.createElement("table");
    t.style.cssText =
      "width:100%;border-collapse:collapse;font-size:14px;line-height:1.4;";
    const cell = (tag: "th" | "td", text: string, weight = "") => {
      const c = document.createElement(tag);
      c.textContent = text;
      c.style.cssText =
        "text-align:left;vertical-align:top;padding:4px 6px 4px 0;" +
        "border-bottom:1px solid var(--zw-line);" +
        (weight ? `font-weight:${weight};` : "");
      return c;
    };
    const head = document.createElement("tr");
    head.append(
      cell("th", "", "600"),
      cell("th", "Before", "600"),
      cell("th", "Now", "600"),
    );
    t.append(
      head,
      ...card.rows.map((r) => {
        const tr = document.createElement("tr");
        tr.append(
          cell("th", r.label, "600"),
          cell("td", r.before),
          cell("td", r.now),
        );
        return tr;
      }),
    );
    return [t];
  };

  return {
    show(outcome, status, extra, kind = "full", arcEnd, arcCard) {
      const skirmish = kind === "skirmish";
      const g = skirmish
        ? SKIRMISH_COPY[outcome.grade === "cleared" ? "cleared" : "loose"]
        : outcomeHeading(outcome.grade, status.reason);
      title.textContent = g.title;
      summary.textContent = arcCard?.summary ?? g.summary;
      compare.replaceChildren(...(arcCard ? table(arcCard) : []));
      const lines = skirmish
        ? []
        : [
            status.reason && status.reason !== "backup"
              ? ENDED[status.reason]
              : "",
            ...outcome.backupReasons.map((r) => BACKUP_REASON[r]),
          ].filter(Boolean);
      reasons.replaceChildren(
        ...lines.map((t) => {
          const li = document.createElement("li");
          li.textContent = t;
          return li;
        }),
      );
      reasons.style.display = lines.length > 0 ? "" : "none";
      carry.replaceChildren(
        ...(skirmish || arcCard ? [] : rows(outcome)),
        ...(extra && !skirmish ? [meaning(extra)] : []),
      );
      next.style.display = extra || arcEnd ? "" : "none";
      again.style.display = extra || arcEnd ? "none" : "";
      fresh.style.display = extra || arcEnd ? "none" : "";
      if (extra) next.textContent = extra.nextLabel;
      else if (arcEnd) next.textContent = arcEnd;
      const { tissue } = outcome;
      stats.style.display = arcCard ? "none" : "";
      stats.textContent = skirmish
        ? `Energy carried forward: ${outcome.energy}.` +
          (extra && !extra.lastWeek
            ? ` You start next with ${extra.energyNext} energy.`
            : "")
        : `Tissue ${tissue.health} of ${tissue.max}` +
          (tissue.lost > 0 ? ` (${tissue.lost} lost)` : " (unharmed)") +
          `. Energy carried forward: ${outcome.energy}. Turns played: ${outcome.turnsPlayed}.` +
          (extra && !extra.lastWeek
            ? ` You start next with ${extra.energyNext} energy.`
            : "");
      luck.textContent = [extra?.luck, extra?.stillHard]
        .filter(Boolean)
        .join(" ");
      luck.style.display = luck.textContent ? "" : "none";
      week.replaceChildren(
        ...(extra?.week
          ? [
              weekHead,
              ...extra.week.map((r) => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;gap:10px;";
                const label = document.createElement("span");
                label.style.cssText =
                  "flex:none;width:52px;font-weight:600;opacity:0.8;";
                label.textContent = r.label;
                const text = document.createElement("span");
                text.style.cssText = "min-width:0;overflow-wrap:anywhere;";
                text.textContent = r.text;
                row.append(label, text);
                return row;
              }),
            ]
          : []),
      );
      week.style.display = extra?.week ? "" : "none";
      open = true;
      setCollapsed(false);
    },
    hide() {
      open = false;
      setCollapsed(false);
    },
  };
}
