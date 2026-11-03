import { pathogenKind } from "../sim/pathogens";
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
  /** One plain line with the week's score and its Choices and Outcome parts. */
  readonly scoreLine?: string;
}

export interface OutcomeOverlay {
  show(
    outcome: BattleOutcome,
    status: BattleStatus,
    extra?: OutcomeExtra,
    kind?: BattleKind,
  ): void;
  hide(): void;
}

const GRADE: Record<BattleGrade, { title: string; summary: string }> = {
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
  backup: "Backup arrived.",
} as const;

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
  const stats = document.createElement("p");
  stats.style.cssText = "margin:0;line-height:1.4;";
  const score = document.createElement("p");
  score.style.cssText = "margin:0;line-height:1.4;font-weight:600;";

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
  card.append(title, summary, reasons, carry, stats, score, buttons);
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
      const kind = pathogenKind(r.kind);
      const li = document.createElement("li");
      li.textContent = `${kind.label}, size ${r.size}: ${WHERE[r.source]}`;
      const sub = document.createElement("div");
      sub.style.cssText = "font-size:12px;opacity:0.65;";
      sub.textContent = kind.organism;
      li.append(sub);
      list.append(li);
    }
    return [head, list];
  };

  return {
    show(outcome, status, extra, kind = "full") {
      const skirmish = kind === "skirmish";
      const g = skirmish
        ? SKIRMISH_COPY[outcome.grade === "cleared" ? "cleared" : "loose"]
        : GRADE[outcome.grade];
      title.textContent = g.title;
      summary.textContent = g.summary;
      const lines = skirmish
        ? []
        : [
            status.reason ? ENDED[status.reason] : "",
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
        ...(skirmish ? [] : rows(outcome)),
        ...(extra && !skirmish ? [meaning(extra)] : []),
      );
      next.style.display = extra ? "" : "none";
      again.style.display = extra ? "none" : "";
      fresh.style.display = extra ? "none" : "";
      if (extra) next.textContent = extra.nextLabel;
      const { tissue } = outcome;
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
      score.textContent = extra?.scoreLine ?? "";
      score.style.display = extra?.scoreLine ? "" : "none";
      open = true;
      setCollapsed(false);
    },
    hide() {
      open = false;
      setCollapsed(false);
    },
  };
}
