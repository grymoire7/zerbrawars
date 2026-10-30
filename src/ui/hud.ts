export interface HudOrder {
  readonly swarmId: string;
  readonly text: string;
  readonly hasOrder: boolean;
  readonly selected: boolean;
}

export interface HudOdds {
  readonly title: string;
  readonly organism: string;
  readonly text: string;
  readonly killChance: number;
  readonly pending: boolean;
  readonly valid: boolean;
}

export interface HudPlayback {
  readonly playing: boolean;
  readonly speed: 1 | 2;
  readonly canReplay: boolean;
  /** Turn being played (the pre-turn number). */
  readonly turn: number;
}

export interface HudWall {
  readonly swarmId: string;
  readonly queued: boolean;
  /** Why it cannot be done, or null. */
  readonly reason: string | null;
  readonly lines: readonly string[];
}

export interface HudForecast {
  /** Tissue health the turn's inflammation tick will cost. */
  readonly tissueDamage: number;
  readonly rising: number;
  readonly slowed: readonly string[];
}

export interface HudModel {
  readonly turn: number;
  readonly over: boolean;
  readonly maxTurns: number;
  readonly tissueHealth: number;
  readonly canEndTurn: boolean;
  readonly log: readonly string[];
  readonly orders: readonly HudOrder[];
  readonly odds: readonly HudOdds[];
  readonly problems: readonly string[];
  readonly wall: HudWall | null;
  readonly forecast: HudForecast | null;
  readonly playback: HudPlayback;
}

export interface Hud {
  update(model: HudModel): void;
  /** Cheap per-frame update while a turn plays: ticking tissue number and progress 0..1. */
  setLive(tissueHealth: number, progress: number): void;
  /** Brief highlight of the log (the reduced-motion summary). */
  pulse(): void;
}

export interface HudHandlers {
  onEndTurn(): void;
  onSkip(): void;
  onReplay(): void;
  onSpeed(speed: 1 | 2): void;
  onReset(): void;
  onSelect(swarmId: string): void;
  onClearOrder(swarmId: string): void;
  onWallOff(): void;
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

  const problems = document.createElement("div");
  problems.style.cssText =
    panel +
    "padding:4px 8px;font:12px monospace;max-width:min(92vw,520px);box-sizing:border-box;" +
    "border-color:#ff5040;color:#ffb4aa;";
  problems.setAttribute("role", "alert");

  const odds = document.createElement("div");
  odds.style.cssText =
    "display:flex;flex-direction:column;gap:6px;align-items:stretch;pointer-events:auto;" +
    "max-width:min(92vw,520px);box-sizing:border-box;";

  const forecast = document.createElement("div");
  forecast.style.cssText =
    panel +
    "padding:4px 8px;font:12px sans-serif;max-width:min(92vw,520px);box-sizing:border-box;";

  const wallCard = document.createElement("div");
  wallCard.style.cssText =
    panel +
    "padding:8px 10px;box-sizing:border-box;font:13px sans-serif;max-width:min(92vw,520px);" +
    "pointer-events:auto;";

  const orders = document.createElement("div");
  orders.style.cssText =
    "display:flex;gap:6px;flex-wrap:wrap;justify-content:center;pointer-events:auto;font:12px monospace;";

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
  const wallOff = button("Wall off (W)", handlers.onWallOff);
  const endTurn = button("End Turn", handlers.onEndTurn);
  const reset = button("Reset", handlers.onReset);
  const replay = button("Replay last turn", handlers.onReplay);
  const x1 = button("1x", () => handlers.onSpeed(1));
  const x2 = button("2x", () => handlers.onSpeed(2));
  const skip = button("Skip", handlers.onSkip);
  skip.title = "Skip to the end of the turn (Enter or Space)";
  const progress = document.createElement("div");
  progress.style.cssText =
    "position:absolute;left:0;bottom:0;height:3px;background:#9fd8f0;width:0;";
  stats.style.position = "relative";
  stats.style.overflow = "hidden";
  stats.append(progress);
  row.append(stats, wallOff, endTurn, x1, x2, skip, replay, reset);
  bar.append(log, problems, forecast, wallCard, odds, orders, row);
  root.appendChild(bar);

  // Key for the heat patterns on the board; the pattern carries the level, not just the color.
  const legend = document.createElement("div");
  legend.style.cssText =
    panel +
    "position:absolute;left:8px;top:32px;padding:4px 8px;font:12px sans-serif;color:#c8ccd4;" +
    "display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:min(60vw,360px);";
  const dark = "#4a130e";
  const swatch = (bg: string, text: string) => {
    const w = document.createElement("span");
    w.style.cssText = "display:inline-flex;align-items:center;gap:4px;";
    const sw = document.createElement("span");
    sw.setAttribute("aria-hidden", "true");
    sw.style.cssText = `width:16px;height:16px;border-radius:2px;background-color:#c4554a;${bg}`;
    w.append(sw, text);
    return w;
  };
  legend.append(
    "Heat:",
    swatch(
      `background-image:radial-gradient(${dark} 28%,transparent 32%);background-size:8px 8px;`,
      "warm",
    ),
    swatch(
      `background-image:repeating-linear-gradient(45deg,${dark} 0 2px,transparent 2px 5px);`,
      "hot: slows",
    ),
    swatch(
      `background-image:repeating-linear-gradient(45deg,${dark} 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,${dark} 0 2px,transparent 2px 5px);`,
      "inflamed",
    ),
  );
  root.appendChild(legend);

  let shownTissue = -1;

  const orderChip = (o: HudOrder) => {
    const chip = document.createElement("div");
    chip.style.cssText =
      panel +
      "display:flex;align-items:center;min-height:44px;box-sizing:border-box;" +
      (o.selected ? "border:2px solid #d05cff;" : "");
    const pick = document.createElement("button");
    pick.type = "button";
    pick.textContent =
      (o.selected ? "[ " : "") + o.text + (o.selected ? " ]" : "");
    pick.style.cssText =
      "min-height:42px;padding:0 10px;font:inherit;background:none;border:0;color:inherit;";
    pick.addEventListener("click", () => handlers.onSelect(o.swarmId));
    chip.append(pick);
    if (o.hasOrder) {
      const clear = document.createElement("button");
      clear.type = "button";
      clear.textContent = "Clear";
      clear.setAttribute("aria-label", `Clear order for ${o.swarmId}`);
      clear.style.cssText =
        "min-height:42px;min-width:44px;padding:0 8px;font:inherit;";
      clear.addEventListener("click", () => handlers.onClearOrder(o.swarmId));
      chip.append(clear);
    }
    return chip;
  };

  const oddsCard = (o: HudOdds) => {
    const card = document.createElement("div");
    card.style.cssText =
      panel +
      "padding:8px 10px;box-sizing:border-box;font:13px sans-serif;" +
      (o.pending ? "border:2px solid #d05cff;" : "border-style:dashed;");
    card.title = o.organism;
    const head = document.createElement("div");
    head.style.cssText = "font-weight:600;";
    head.textContent = `Engulf ${o.title}`;
    const sub = document.createElement("div");
    sub.style.cssText = "font-size:11px;opacity:0.65;";
    sub.textContent = o.organism;
    const text = document.createElement("div");
    text.textContent = o.text;
    if (!o.valid) text.style.color = "#ffb4aa";
    const pct = Math.round(o.killChance * 100);
    const meter = document.createElement("div");
    meter.style.cssText =
      "display:flex;align-items:center;gap:8px;margin-top:4px;font:12px monospace;";
    meter.setAttribute("role", "img");
    meter.setAttribute("aria-label", `Kill chance ${pct}%`);
    const track = document.createElement("div");
    track.style.cssText =
      "flex:1;height:8px;border-radius:4px;background:#3a3f4a;overflow:hidden;";
    const fill = document.createElement("div");
    fill.style.cssText = `width:${pct}%;height:100%;background:#d05cff;`;
    track.append(fill);
    const label = document.createElement("span");
    label.textContent = `kill ${pct}%`;
    meter.append(track, label);
    card.append(head, sub, text, meter);
    return card;
  };

  const line = (text: string, style = "") => {
    const d = document.createElement("div");
    d.textContent = text;
    d.style.cssText = style;
    return d;
  };

  return {
    update(m) {
      const f = m.forecast;
      forecast.style.display = f ? "block" : "none";
      if (f) {
        const parts = [
          f.tissueDamage > 0
            ? `Heat will cost ${f.tissueDamage} tissue this turn.`
            : "No tissue lost to heat this turn.",
          f.rising > 0
            ? `${f.rising} ${f.rising === 1 ? "tile" : "tiles"} heating up (arrows).`
            : "",
          f.slowed.length > 0
            ? `Slowed next turn: ${f.slowed.join(", ")}.`
            : "",
        ].filter(Boolean);
        forecast.textContent = parts.join(" ");
      }
      const w = m.wall;
      wallCard.style.display = w ? "block" : "none";
      wallCard.style.border = w?.queued
        ? "2px solid #d05cff"
        : "1px dashed #3a3f4a";
      wallCard.replaceChildren(
        ...(w
          ? [
              line(`Wall off ${w.swarmId}`, "font-weight:600;"),
              ...w.lines.map((t) => line(t)),
              ...(w.reason
                ? [line(`Cannot: ${w.reason}.`, "color:#ffb4aa;")]
                : []),
            ]
          : []),
      );
      wallOff.style.display = w && !m.playback.playing ? "" : "none";
      wallOff.textContent = w?.queued ? "Cancel wall off (W)" : "Wall off (W)";
      wallOff.disabled = !w || (!w.queued && w.reason !== null);
      odds.style.display = m.odds.length > 0 ? "flex" : "none";
      odds.replaceChildren(...m.odds.map(oddsCard));
      orders.style.display = m.orders.length > 0 ? "flex" : "none";
      orders.replaceChildren(...m.orders.map(orderChip));
      problems.style.display = m.problems.length > 0 ? "block" : "none";
      problems.replaceChildren(
        ...m.problems.map((line) => {
          const d = document.createElement("div");
          d.textContent = line;
          return d;
        }),
      );
      const pb = m.playback;
      if (pb.playing) {
        turn.textContent = `Playing turn ${pb.turn}`;
        turn.style.color = "#9fd8f0";
      } else {
        turn.textContent = m.over
          ? `Battle finished after ${Math.min(m.turn - 1, m.maxTurns)} turns`
          : `Turn ${m.turn} / ${m.maxTurns}`;
        turn.style.color = "";
        progress.style.width = "0";
      }
      if (!pb.playing) {
        shownTissue = m.tissueHealth;
        health.textContent = `Tissue ${m.tissueHealth}`;
      }
      endTurn.disabled = !m.canEndTurn;
      endTurn.style.display = pb.playing ? "none" : "";
      for (const [b, s] of [
        [x1, 1],
        [x2, 2],
      ] as const) {
        b.style.display = pb.playing ? "" : "none";
        b.setAttribute("aria-pressed", String(pb.speed === s));
        b.style.fontWeight = pb.speed === s ? "700" : "";
        b.style.outline = pb.speed === s ? "2px solid #9fd8f0" : "";
      }
      skip.style.display = pb.playing ? "" : "none";
      replay.style.display = pb.playing ? "none" : "";
      replay.disabled = !pb.canReplay;
      reset.disabled = pb.playing;
      log.style.display = m.log.length > 0 ? "block" : "none";
      log.replaceChildren(
        ...m.log.map((line) => {
          const d = document.createElement("div");
          d.textContent = line;
          return d;
        }),
      );
    },
    setLive(tissue, p) {
      if (tissue !== shownTissue) {
        shownTissue = tissue;
        health.textContent = `Tissue ${tissue}`;
      }
      progress.style.width = `${Math.round(p * 100)}%`;
    },
    pulse() {
      log.animate(
        [
          { boxShadow: "0 0 0 2px #ff8a5c", background: "rgba(80,48,40,0.9)" },
          { boxShadow: "0 0 0 0 transparent" },
        ],
        { duration: 900, easing: "ease-out" },
      );
    },
  };
}
