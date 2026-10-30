export interface HudModel {
  readonly turn: number;
  readonly maxTurns: number;
  readonly tissueHealth: number;
  readonly canEndTurn: boolean;
  readonly log: readonly string[];
}

export interface Hud {
  update(model: HudModel): void;
}

export interface HudHandlers {
  onEndTurn(): void;
  onReset(): void;
}

export function createHud(root: HTMLElement, handlers: HudHandlers): Hud {
  const bar = document.createElement("div");
  bar.style.cssText =
    "position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;" +
    "align-items:center;gap:6px;padding:8px;pointer-events:none;font:14px sans-serif;color:#e4e7ee;";
  const panel =
    "background:rgba(26,28,34,0.85);border:1px solid #3a3f4a;border-radius:6px;";

  const log = document.createElement("div");
  log.style.cssText =
    panel +
    "padding:4px 8px;font:12px monospace;max-width:min(92vw,520px);box-sizing:border-box;";
  log.setAttribute("aria-live", "polite");

  const row = document.createElement("div");
  row.style.cssText =
    "display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;pointer-events:auto;";
  const stats = document.createElement("div");
  stats.style.cssText =
    panel +
    "padding:6px 10px;min-height:44px;box-sizing:border-box;display:flex;gap:12px;align-items:center;";
  const turn = document.createElement("span");
  const health = document.createElement("span");
  stats.append(turn, health);

  const button = (text: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText =
      "min-height:44px;min-width:44px;padding:0 16px;font:inherit;";
    b.addEventListener("click", onClick);
    return b;
  };
  const endTurn = button("End Turn", handlers.onEndTurn);
  const reset = button("Reset", handlers.onReset);
  row.append(stats, endTurn, reset);
  bar.append(log, row);
  root.appendChild(bar);

  let canEnd = true;
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.repeat || !canEnd) return;
    // Focused controls already turn Enter into a click.
    const t = e.target as HTMLElement | null;
    if (t && ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(t.tagName))
      return;
    handlers.onEndTurn();
  });

  return {
    update(m) {
      canEnd = m.canEndTurn;
      turn.textContent = m.canEndTurn
        ? `Turn ${m.turn} / ${m.maxTurns}`
        : "Battle over (T8 pending)";
      health.textContent = `Tissue ${m.tissueHealth}`;
      endTurn.disabled = !m.canEndTurn;
      log.style.display = m.log.length > 0 ? "block" : "none";
      log.replaceChildren(
        ...m.log.map((line) => {
          const d = document.createElement("div");
          d.textContent = line;
          return d;
        }),
      );
    },
  };
}
