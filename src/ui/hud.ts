export interface HudOrder {
  readonly swarmId: string;
  /** Status chip text: "no order", "move", "hold", "engulf", "wall off", "busy". */
  readonly label: string;
  /** What the order does, e.g. "-> 5,4"; empty without one. */
  readonly detail: string;
  readonly hasOrder: boolean;
  readonly idle: boolean;
  readonly selected: boolean;
}

export interface HudInfo {
  readonly title: string;
  readonly sub: string;
  readonly lines: readonly string[];
}

export interface HudKey {
  /** Heat levels on the board right now (1..3). */
  readonly heatLevels: readonly number[];
  /** Some tile will heat up next turn (the flame glow). */
  readonly forecast: boolean;
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
  /** Swarms that will hold because they have no order. */
  readonly holding: number;
  readonly hint: string;
  readonly info: HudInfo | null;
  readonly key: HudKey;
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
  onHelp(): void;
}

/** Side-panel regions: a scrolling column and a pinned control bar. */
export interface HudMounts {
  readonly scroll: HTMLElement;
  readonly bar: HTMLElement;
}

const PANEL = "background:#262a33;border:1px solid #3a3f4a;border-radius:6px;";
const DARK = "#4a130e";
const STATUS_COLOR: Record<string, string> = {
  "no order": "#8a8f9a",
  busy: "#8a8f9a",
};

export function createHud(mounts: HudMounts, handlers: HudHandlers): Hud {
  const { scroll, bar } = mounts;
  const el = (tag: string, css = "", text = "") => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  };
  const button = (text: string, onClick: () => void, css = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.style.cssText = "min-height:44px;min-width:44px;padding:0 14px;" + css;
    b.addEventListener("click", onClick);
    return b;
  };
  const line = (text: string, css = "") => el("div", css, text);

  // Turn and tissue summary, with the How to play button.
  const stats = el(
    "div",
    PANEL +
      "position:relative;overflow:hidden;padding:4px 4px 4px 10px;min-height:44px;" +
      "box-sizing:border-box;display:flex;gap:14px;align-items:center;font-size:15px;",
  );
  const turn = el("span", "font-weight:600;");
  const health = el("span");
  const help = button(
    "?",
    handlers.onHelp,
    "margin-left:auto;font-weight:700;",
  );
  help.setAttribute("aria-label", "How to play");
  help.title = "How to play";
  const progress = el(
    "div",
    "position:absolute;left:0;bottom:0;height:3px;background:#9fd8f0;width:0;",
  );
  stats.append(turn, health, help, progress);

  // Orders: how many swarms have one, and a status chip per swarm.
  const ordersBox = el("div", PANEL + "padding:8px 10px;");
  const ordersHead = el("div", "font-weight:600;margin-bottom:4px;");
  const ordersNote = el(
    "div",
    "font-size:12px;opacity:0.7;margin-bottom:6px;line-height:1.3;",
    "One order per swarm each turn. No order means hold.",
  );
  const ordersList = el("div", "display:flex;flex-direction:column;gap:6px;");
  ordersBox.append(ordersHead, ordersNote, ordersList);

  const problems = el(
    "div",
    PANEL +
      "padding:6px 10px;font-size:13px;border-color:#ff5040;color:#ffb4aa;",
  );
  problems.setAttribute("role", "alert");

  const infoBox = el("div", PANEL + "padding:8px 10px;font-size:13px;");
  const preview = el("div", "display:flex;flex-direction:column;gap:8px;");

  // Key: heat patterns (only those on the board) and the telegraph marks.
  const key = el("details", PANEL) as HTMLDetailsElement;
  key.open = window.matchMedia("(min-width: 900px)").matches;
  const keySummary = el(
    "summary",
    "min-height:44px;display:flex;align-items:center;padding:0 10px;cursor:pointer;font-weight:600;",
    "Key",
  );
  const keyBody = el(
    "div",
    "padding:0 10px 10px;display:flex;flex-direction:column;gap:6px;font-size:13px;",
  );
  key.append(keySummary, keyBody);

  const logBox = el("details", PANEL) as HTMLDetailsElement;
  logBox.open = true;
  const logSummary = el(
    "summary",
    "min-height:44px;display:flex;align-items:center;padding:0 10px;cursor:pointer;font-weight:600;",
    "What happened",
  );
  const log = el(
    "div",
    "padding:0 10px 10px;font:12px monospace;max-height:140px;overflow-y:auto;",
  );
  log.setAttribute("aria-live", "polite");
  log.tabIndex = 0;
  log.setAttribute("aria-label", "What happened last turn");
  logBox.append(logSummary, log);

  scroll.append(stats, ordersBox, problems, infoBox, preview, key, logBox);

  // Pinned controls.
  const endTurn = button(
    "",
    handlers.onEndTurn,
    "min-height:52px;flex:1 1 100%;",
  );
  endTurn.style.fontWeight = "700";
  endTurn.style.display = "flex";
  endTurn.style.flexDirection = "column";
  endTurn.style.alignItems = "center";
  endTurn.style.justifyContent = "center";
  endTurn.style.lineHeight = "1.2";
  const endLabel = el("span", "font-size:16px;", "End Turn");
  const endHint = el("span", "font-size:12px;font-weight:400;opacity:0.7;");
  endTurn.append(endLabel, endHint);
  const row = el("div", "display:flex;gap:6px;flex-wrap:wrap;");
  const wallOff = button("Wall off (W)", handlers.onWallOff, "flex:1 1 auto;");
  const x1 = button("1x", () => handlers.onSpeed(1), "flex:1 1 auto;");
  const x2 = button("2x", () => handlers.onSpeed(2), "flex:1 1 auto;");
  const skip = button("Skip", handlers.onSkip, "flex:2 1 auto;");
  skip.title = "Skip to the end of the turn (Enter or Space)";
  const replay = button(
    "Replay last turn",
    handlers.onReplay,
    "flex:2 1 auto;",
  );
  const reset = button("Reset", handlers.onReset, "flex:1 1 auto;");
  row.append(endTurn, wallOff, x1, x2, skip, replay, reset);
  bar.append(row);

  let shownTissue = -1;

  const swatch = (css: string) => {
    const sw = el(
      "span",
      `display:inline-block;width:16px;height:16px;border-radius:2px;flex:none;background-color:#c4554a;${css}`,
    );
    sw.setAttribute("aria-hidden", "true");
    return sw;
  };
  const glyph = (text: string, color: string) => {
    const g = el(
      "span",
      `display:inline-block;min-width:16px;text-align:center;font-weight:700;color:${color};flex:none;`,
      text,
    );
    g.setAttribute("aria-hidden", "true");
    return g;
  };
  const keyRow = (mark: HTMLElement, text: string) => {
    const r = el(
      "div",
      "display:flex;gap:8px;align-items:center;line-height:1.3;",
    );
    r.append(mark, text);
    return r;
  };
  const HEAT: Record<number, [string, string]> = {
    1: [
      `background-image:radial-gradient(${DARK} 28%,transparent 32%);background-size:8px 8px;`,
      "Warm: costs a little tissue",
    ],
    2: [
      `background-image:repeating-linear-gradient(45deg,${DARK} 0 2px,transparent 2px 5px);`,
      "Inflamed: swarms here move 1 less",
    ],
    3: [
      `background-image:repeating-linear-gradient(45deg,${DARK} 0 2px,transparent 2px 5px),repeating-linear-gradient(-45deg,${DARK} 0 2px,transparent 2px 5px);`,
      "Very inflamed: swarms here move 1 less",
    ],
  };
  const chipSwatch = () => {
    const c = el(
      "span",
      `display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:none;` +
        `background:radial-gradient(circle,#ff9628 0%,rgba(255,110,20,0.5) 60%,transparent 100%);` +
        `color:#fff3c4;font-size:10px;`,
      "▲",
    );
    c.setAttribute("aria-hidden", "true");
    return c;
  };
  let keyText = "";
  const updateKey = (k: HudKey) => {
    const sig = `${k.heatLevels.join()}|${k.forecast}`;
    if (sig === keyText) return;
    keyText = sig;
    const heat = [
      ...k.heatLevels.map((l) => keyRow(swatch(HEAT[l]![0]), HEAT[l]![1])),
      ...(k.forecast
        ? [
            keyRow(
              chipSwatch(),
              "Corner flame glow: this tile will heat up next turn",
            ),
          ]
        : []),
    ];
    keyBody.replaceChildren(
      line("What germs will do next turn", "font-weight:600;"),
      keyRow(glyph("→", "#ffd23f"), "Yellow arrow: spread"),
      keyRow(glyph("···", "#6fb8ff"), "Blue dotted arc: spore"),
      keyRow(
        glyph("◯", "#f2f2f2"),
        "Swelling germ with faint outline: grows (grow 3→4)",
      ),
      keyRow(glyph("✕", "#ff5040"), "Red: blocked by your swarm"),
      keyRow(glyph("3", "#ffffff"), "Number on a germ: its size"),
      ...(heat.length > 0
        ? [line("Heat", "font-weight:600;margin-top:4px;"), ...heat]
        : []),
    );
  };

  const chip = (label: string, hasOrder: boolean) => {
    const c = el(
      "span",
      "display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;" +
        `border:1px solid ${STATUS_COLOR[label] ?? "#d05cff"};` +
        (hasOrder ? "background:#3a2a4a;color:#f0d8ff;" : "color:#aab0bb;"),
      label,
    );
    return c;
  };

  const orderRow = (o: HudOrder) => {
    const r = el(
      "div",
      "display:flex;align-items:stretch;gap:4px;border-radius:6px;" +
        (o.selected ? "outline:2px solid #d05cff;" : ""),
    );
    const pick = el(
      "button",
      "flex:1 1 auto;min-height:44px;padding:0 10px;display:flex;align-items:center;gap:8px;" +
        "text-align:left;flex-wrap:wrap;",
    ) as HTMLButtonElement;
    pick.type = "button";
    pick.setAttribute("aria-pressed", String(o.selected));
    pick.append(el("strong", "", o.swarmId), chip(o.label, o.hasOrder));
    if (o.detail)
      pick.append(el("span", "font:12px monospace;opacity:0.75;", o.detail));
    pick.addEventListener("click", () => handlers.onSelect(o.swarmId));
    r.append(pick);
    if (o.hasOrder) {
      const clear = button("Clear", () => handlers.onClearOrder(o.swarmId));
      clear.setAttribute("aria-label", `Clear order for ${o.swarmId}`);
      r.append(clear);
    }
    return r;
  };

  const oddsCard = (o: HudOdds) => {
    const card = el(
      "div",
      PANEL +
        "padding:8px 10px;font-size:13px;" +
        (o.pending ? "border:2px solid #d05cff;" : "border-style:dashed;"),
    );
    card.title = o.organism;
    const pct = Math.round(o.killChance * 100);
    const text = line(o.text);
    if (!o.valid) text.style.color = "#ffb4aa";
    const meter = el(
      "div",
      "display:flex;align-items:center;gap:8px;margin-top:4px;font:12px monospace;",
    );
    meter.setAttribute("role", "img");
    meter.setAttribute("aria-label", `Kill chance ${pct}%`);
    const track = el(
      "div",
      "flex:1;height:8px;border-radius:4px;background:#3a3f4a;overflow:hidden;",
    );
    track.append(el("div", `width:${pct}%;height:100%;background:#d05cff;`));
    meter.append(track, el("span", "", `kill ${pct}%`));
    card.append(
      line(`Engulf ${o.title}`, "font-weight:600;"),
      line(o.organism, "font-size:11px;opacity:0.65;"),
      text,
      meter,
    );
    return card;
  };

  return {
    update(m) {
      const pb = m.playback;
      if (pb.playing) {
        turn.textContent = `Playing turn ${pb.turn}`;
        turn.style.color = "#9fd8f0";
      } else {
        turn.textContent = m.over
          ? `Finished after ${Math.min(m.turn - 1, m.maxTurns)} turns`
          : `Turn ${m.turn} / ${m.maxTurns}`;
        turn.style.color = "";
        progress.style.width = "0";
        shownTissue = m.tissueHealth;
        health.textContent = `Tissue ${m.tissueHealth}`;
      }

      ordersBox.style.display = pb.playing ? "none" : "";
      const ordered = m.orders.filter((o) => o.hasOrder).length;
      ordersHead.textContent = `Orders: ${ordered} of ${m.orders.length} swarms`;
      ordersList.replaceChildren(...m.orders.map(orderRow));
      problems.style.display = m.problems.length > 0 ? "block" : "none";
      problems.replaceChildren(...m.problems.map((t) => line(t)));

      const i = m.info;
      infoBox.style.display = i ? "block" : "none";
      infoBox.replaceChildren(
        ...(i
          ? [
              line(i.title, "font-weight:600;font-size:14px;"),
              line(i.sub, "font-size:11px;opacity:0.65;margin-bottom:2px;"),
              ...i.lines.map((t) => line(t)),
            ]
          : []),
      );

      const w = m.wall;
      const f = m.forecast;
      const cards: HTMLElement[] = m.odds.map(oddsCard);
      if (w) {
        const c = el(
          "div",
          PANEL +
            "padding:8px 10px;font-size:13px;" +
            (w.queued ? "border:2px solid #d05cff;" : "border-style:dashed;"),
        );
        c.append(
          line(`Wall off ${w.swarmId}`, "font-weight:600;"),
          ...w.lines.map((t) => line(t)),
          ...(w.reason ? [line(`Cannot: ${w.reason}.`, "color:#ffb4aa;")] : []),
        );
        cards.push(c);
      }
      if (f) {
        const parts = [
          f.tissueDamage > 0
            ? `Heat will cost ${f.tissueDamage} tissue this turn.`
            : "No tissue lost to heat this turn.",
          f.rising > 0
            ? `${f.rising} ${f.rising === 1 ? "tile" : "tiles"} will heat up (corner flames).`
            : "",
          f.slowed.length > 0
            ? `Slowed next turn: ${f.slowed.join(", ")}.`
            : "",
        ].filter(Boolean);
        cards.push(
          line(parts.join(" "), PANEL + "padding:6px 10px;font-size:12px;"),
        );
      }
      preview.style.display = cards.length > 0 ? "flex" : "none";
      preview.replaceChildren(...cards);

      updateKey(m.key);

      wallOff.style.display = w && !pb.playing ? "" : "none";
      wallOff.textContent = w?.queued ? "Cancel wall off (W)" : "Wall off (W)";
      wallOff.disabled = !w || (!w.queued && w.reason !== null);
      endTurn.disabled = !m.canEndTurn;
      endTurn.style.display = pb.playing ? "none" : "flex";
      endHint.textContent = m.hint;
      endHint.style.display = m.hint ? "" : "none";
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
      logBox.style.display = m.log.length > 0 ? "block" : "none";
      log.replaceChildren(...m.log.map((t) => line(t)));
    },
    setLive(tissue, p) {
      if (tissue !== shownTissue) {
        shownTissue = tissue;
        health.textContent = `Tissue ${tissue}`;
      }
      progress.style.width = `${Math.round(p * 100)}%`;
    },
    pulse() {
      logBox.animate(
        [
          { boxShadow: "0 0 0 2px #ff8a5c", background: "rgba(80,48,40,0.9)" },
          { boxShadow: "0 0 0 0 transparent" },
        ],
        { duration: 900, easing: "ease-out" },
      );
    },
  };
}
