import type { BattleKind } from "../sim/types";
import { turnText } from "../app/arrivalModel";
import { createInfoTips } from "./infoTip";
import { PATHOGEN_KINDS, type PathogenKindId } from "../sim/pathogens";
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

export interface HudMedication {
  /** 0..1 medication level (equal to the aura at setup). */
  readonly level: number;
  /** Chance each germ is held back each turn, 0..1. */
  readonly stallChance: number;
}

export interface HudCharge {
  readonly charge: string;
  readonly label: string;
  readonly count: number;
  readonly selected: boolean;
}

/** The queued support order, shown beside the swarm orders. */
export interface HudSupport {
  readonly charge: string;
  /** e.g. "-> p2". */
  readonly detail: string;
  /** Why it would be refused, or null. */
  readonly problem: string | null;
}

export interface HudSupportCard {
  readonly title: string;
  readonly text: string;
  readonly pending: boolean;
  readonly valid: boolean;
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
  /** Medication aura above zero: germs can be held back. */
  readonly aura: boolean;
  /** At least one charge is left. */
  readonly charges: boolean;
  /** Germ kinds on the board right now (hidden ones left out), for the shape and rim key. */
  readonly kinds: readonly PathogenKindId[];
  /** An incoming-germ ring is on the board. */
  readonly incoming: boolean;
  /** A swarm is standing on a door with a group due. */
  readonly incomingBlocked: boolean;
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
  /** "Next: 1 Staph, turn 3" (terse) and its full-sentence aria text. */
  readonly next: { readonly text: string; readonly aria: string };
  /** A skirmish is labelled in the turn line. */
  readonly kind: BattleKind;
  readonly canEndTurn: boolean;
  readonly log: readonly string[];
  readonly orders: readonly HudOrder[];
  readonly medication: HudMedication;
  readonly charges: readonly HudCharge[];
  /** The picked charge has nothing to hit right now. */
  readonly noTargets: boolean;
  readonly support: HudSupport | null;
  readonly supportCard: HudSupportCard | null;
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
  /** Cheap per-frame update while a turn plays: progress 0..1. */
  setLive(progress: number): void;
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
  onPickCharge(charge: string): void;
  onClearSupport(): void;
  onHelp(): void;
}

/** Side-panel regions: a scrolling column and a pinned control bar. */
export interface HudMounts {
  readonly scroll: HTMLElement;
  readonly bar: HTMLElement;
}

const PANEL =
  "background:var(--zw-raised);border:1px solid var(--zw-line);border-radius:6px;";
const DARK = "var(--zw-heat-ink)";
/** Colour name for each organism in the on-screen key; matches the palette tokens. */
const GERM_COLOR_WORD: Record<PathogenKindId, string> = {
  strep: "Orange",
  staph: "Teal",
  aspergillus: "Violet",
};

const STATUS_COLOR: Record<string, string> = {
  "no order": "var(--zw-text-muted)",
  busy: "var(--zw-text-muted)",
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
  const tip = createInfoTips();
  const ROW =
    "display:flex;align-items:center;justify-content:space-between;gap:6px;";

  // Turn summary, with the How to play button (tissue lives in the status strip).
  const stats = el(
    "div",
    PANEL +
      "position:relative;overflow:hidden;padding:4px 4px 4px 10px;min-height:44px;" +
      "box-sizing:border-box;display:flex;gap:8px;align-items:center;font-size:15px;",
  );
  const turn = el("span", "font-weight:600;");
  const next = el("span", "font-size:14px;color:var(--zw-text-muted);");
  const turnBox = el("div", "flex:1 1 auto;min-width:0;line-height:1.25;");
  turnBox.append(turn, " ", next);
  const help = button(
    "?",
    handlers.onHelp,
    "margin-left:auto;font-weight:700;",
  );
  help.setAttribute("aria-label", "How to play");
  help.title = "How to play";
  const progress = el(
    "div",
    "position:absolute;left:0;bottom:0;height:3px;background:var(--zw-focus);width:0;",
  );
  stats.append(turnBox, help, progress);

  // Medication: the note on the aura and the charge chips (the level is in the status strip).
  const medBox = el("div", PANEL + "padding:8px 10px;");
  const medHead = el("div", ROW + "font-weight:600;");
  const medLabel = el("span", "", "Medication");
  const medTip = tip("battle-med", "", "medication");
  medHead.append(medLabel, medTip.button);
  const medNote = medTip.note;
  const chipRow = el(
    "div",
    "display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;",
  );
  const chipHint = el("div", "font-size:12px;margin-top:4px;line-height:1.3;");
  chipHint.setAttribute("aria-live", "polite");
  medBox.append(medHead, medNote, chipRow, chipHint);

  // Orders: how many swarms have one, and a status chip per swarm.
  const ordersBox = el("div", PANEL + "padding:8px 10px;");
  const ordersHeadRow = el("div", ROW);
  const ordersHead = el("span", "font-weight:600;");
  const ordersTip = tip(
    "battle-orders",
    "One order per swarm each turn. No order means hold.",
    "orders",
  );
  ordersHeadRow.append(ordersHead, ordersTip.button);
  ordersTip.note.style.marginBottom = "6px";
  const ordersList = el("div", "display:flex;flex-direction:column;gap:6px;");
  ordersBox.append(ordersHeadRow, ordersTip.note, ordersList);

  const problems = el(
    "div",
    PANEL +
      "padding:6px 10px;font-size:13px;border-color:var(--zw-warn-line);color:var(--zw-warn);",
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

  scroll.append(
    stats,
    medBox,
    ordersBox,
    problems,
    infoBox,
    preview,
    key,
    logBox,
  );

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

  const swatch = (css: string) => {
    const sw = el(
      "span",
      `display:inline-block;width:16px;height:16px;border-radius:2px;flex:none;background-color:var(--zw-tissue-damaged);${css}`,
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
        `background:radial-gradient(circle,var(--zw-heat) 0%,rgba(255,110,20,0.5) 60%,transparent 100%);` +
        `color:var(--zw-kill);font-size:10px;`,
      "▲",
    );
    c.setAttribute("aria-hidden", "true");
    return c;
  };
  const keyTip = tip(
    "battle-key",
    "Engulfing kills a round germ with no shell. A pale ring is a shell: engulfing it loads your swarm instead. A charge kills what it hits outright, no dice. A stronger green glow holds more germs back. A swarm that starts on an inflamed tile moves 1 less.",
    "the key",
  );
  const keyTipRow = el("div", ROW + "font-size:12px;opacity:0.85;");
  keyTipRow.append(el("span", "", "Good to know"), keyTip.button);
  let keyText = "";
  const updateKey = (k: HudKey) => {
    const sig = `${k.heatLevels.join()}|${k.forecast}|${k.aura}|${k.charges}|${k.kinds.join()}|${k.incoming}|${k.incomingBlocked}`;
    if (sig === keyText) return;
    keyText = sig;
    const heat = [
      ...k.heatLevels.map((l) => keyRow(swatch(HEAT[l]![0]), HEAT[l]![1])),
      ...(k.forecast
        ? [keyRow(chipSwatch(), "Corner flame: heats up next turn")]
        : []),
    ];
    const germRows = k.kinds.map((id) => {
      const def = PATHOGEN_KINDS[id];
      const body =
        def.form === "mold"
          ? `background:var(--zw-${id});clip-path:polygon(50% 0,62% 30%,100% 50%,62% 70%,50% 100%,38% 70%,0 50%,38% 30%);`
          : `background:var(--zw-${id});border-radius:50%;`;
      const sealed = def.wall === "sealed";
      const mark = el(
        "span",
        `display:inline-block;width:16px;height:16px;flex:none;box-sizing:border-box;${body}` +
          (sealed
            ? "outline:2px solid var(--zw-sealed-rim);outline-offset:1px;"
            : ""),
      );
      mark.setAttribute("aria-hidden", "true");
      return keyRow(
        mark,
        `${GERM_COLOR_WORD[id]} ${def.form === "mold" ? "spiky dots" : "round dots"}` +
          (sealed ? " with a ring" : "") +
          `: ${def.organism}`,
      );
    });
    keyBody.replaceChildren(
      keyTipRow,
      keyTip.note,
      ...(germRows.length > 0
        ? [line("Germs", "font-weight:600;"), ...germRows]
        : []),
      line("What germs will do next turn", "font-weight:600;margin-top:4px;"),
      keyRow(glyph("→", "var(--zw-spread)"), "Yellow arrow: spread"),
      keyRow(glyph("···", "var(--zw-spore)"), "Blue dotted arc: spore"),
      keyRow(glyph("◯", "var(--zw-grow)"), "Faint outline: the germ grows"),
      keyRow(glyph("✕", "var(--zw-warn-line)"), "Red: blocked by your swarm"),
      ...(k.aura
        ? [
            keyRow(
              glyph("❚❚", "var(--zw-stall)"),
              "Green pause sign: held back by medication",
            ),
          ]
        : []),
      ...(k.incoming
        ? [
            keyRow(
              glyph("◎", "var(--zw-incoming)"),
              "Thick ring with a germ and its size: a germ arrives at this door",
            ),
          ]
        : []),
      ...(k.incomingBlocked
        ? [
            keyRow(
              glyph("✕", "var(--zw-warn-line)"),
              "Dashed ring with a cross: your swarm is on the door",
            ),
          ]
        : []),
      keyRow(glyph("3", "var(--zw-white)"), "Number on a germ: its size"),
      ...(k.aura || k.charges
        ? [
            line("Medication", "font-weight:600;margin-top:4px;"),
            ...(k.aura
              ? [
                  keyRow(
                    glyph("~", "var(--zw-med)"),
                    "Green glow on the board edge: medication aura",
                  ),
                ]
              : []),
            ...(k.charges
              ? [
                  keyRow(
                    glyph("◇", "var(--zw-med)"),
                    "Green diamond: a charge can hit this",
                  ),
                ]
              : []),
          ]
        : []),
      ...(heat.length > 0
        ? [line("Heat", "font-weight:600;margin-top:4px;"), ...heat]
        : []),
    );
  };

  const chip = (label: string, hasOrder: boolean) => {
    const c = el(
      "span",
      "display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;" +
        `border:1px solid ${STATUS_COLOR[label] ?? "var(--zw-order)"};` +
        (hasOrder
          ? "background:var(--zw-order-bg);color:var(--zw-text);"
          : "color:var(--zw-text-muted);"),
      label,
    );
    return c;
  };

  const orderRow = (o: HudOrder) => {
    const r = el(
      "div",
      "display:flex;align-items:stretch;gap:4px;border-radius:6px;" +
        (o.selected ? "outline:2px solid var(--zw-order);" : ""),
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

  const supportRow = (sp: HudSupport) => {
    const r = el(
      "div",
      "display:flex;align-items:stretch;gap:4px;border-radius:6px;",
    );
    const info = el(
      "div",
      "flex:1 1 auto;min-height:44px;padding:0 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;",
    );
    info.append(
      el("strong", "", "Dose"),
      el(
        "span",
        "display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;" +
          `border:1px solid ${sp.problem ? "var(--zw-warn-line)" : "var(--zw-med)"};background:var(--zw-med-bg);color:var(--zw-med);`,
        sp.charge,
      ),
      el("span", "font:12px monospace;opacity:0.75;", sp.detail),
    );
    const clear = button("Clear", handlers.onClearSupport);
    clear.setAttribute("aria-label", "Clear the dose");
    r.append(info, clear);
    return r;
  };

  const supportCardEl = (c: HudSupportCard) => {
    const card = el(
      "div",
      PANEL +
        "padding:8px 10px;font-size:13px;" +
        (c.pending
          ? "border:2px solid var(--zw-med);"
          : "border-style:dashed;"),
    );
    const text = line(c.text);
    if (!c.valid) text.style.color = "var(--zw-warn)";
    card.append(line(c.title, "font-weight:600;"), text);
    return card;
  };

  const oddsCard = (o: HudOdds) => {
    const card = el(
      "div",
      PANEL +
        "padding:8px 10px;font-size:13px;" +
        (o.pending
          ? "border:2px solid var(--zw-order);"
          : "border-style:dashed;"),
    );
    card.title = o.organism;
    const pct = Math.round(o.killChance * 100);
    const text = line(o.text);
    if (!o.valid) text.style.color = "var(--zw-warn)";
    const meter = el(
      "div",
      "display:flex;align-items:center;gap:8px;margin-top:4px;font:12px monospace;",
    );
    meter.setAttribute("role", "img");
    meter.setAttribute("aria-label", `Kill chance ${pct}%`);
    const track = el(
      "div",
      "flex:1;height:8px;border-radius:4px;background:var(--zw-line);overflow:hidden;",
    );
    track.append(
      el("div", `width:${pct}%;height:100%;background:var(--zw-order);`),
    );
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
        turn.style.color = "var(--zw-focus)";
        turn.removeAttribute("aria-label");
        next.style.display = "none";
      } else {
        const line = turnText(m);
        turn.textContent = m.over
          ? `${m.kind === "skirmish" ? "Skirmish over" : "Finished"} after ${Math.min(m.turn - 1, m.maxTurns)} turns`
          : line.text;
        if (m.over) turn.removeAttribute("aria-label");
        else turn.setAttribute("aria-label", line.aria);
        turn.style.color = "";
        next.style.display = m.over ? "none" : "";
        next.textContent = m.next.text;
        next.setAttribute("aria-label", m.next.aria);
        progress.style.width = "0";
      }

      ordersBox.style.display = pb.playing ? "none" : "";
      const ordered = m.orders.filter((o) => o.hasOrder).length;
      ordersHead.textContent = `Orders: ${ordered} of ${m.orders.length} swarms`;
      ordersList.replaceChildren(
        ...m.orders.map(orderRow),
        ...(m.support ? [supportRow(m.support)] : []),
      );

      medBox.style.display = pb.playing ? "none" : "";
      medTip.setText(
        (m.medication.level > 0
          ? `Each germ has a ${Math.round(m.medication.stallChance * 100)}% chance of being held back each turn.`
          : "No medication: nothing holds the germs back.") +
          (m.charges.length > 0
            ? " Pick a charge to use one this turn (one per turn)."
            : ""),
      );
      chipRow.style.display = m.charges.length > 0 ? "flex" : "none";
      chipRow.replaceChildren(
        ...m.charges.map((c) => {
          const b = button(
            `${c.label} x${c.count}`,
            () => handlers.onPickCharge(c.charge),
            "flex:1 1 auto;" +
              (c.selected
                ? "outline:2px solid var(--zw-med);font-weight:700;"
                : ""),
          );
          b.setAttribute("aria-pressed", String(c.selected));
          b.title = "Use this charge on a germ or a carried load";
          return b;
        }),
      );
      const picked = m.charges.some((c) => c.selected);
      chipHint.textContent = picked
        ? m.noTargets
          ? "Nothing this charge can hit right now."
          : "Tap a green diamond on the board."
        : "";
      chipHint.style.color = picked && m.noTargets ? "var(--zw-warn)" : "";
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
      const cards: HTMLElement[] = [
        ...(m.supportCard ? [supportCardEl(m.supportCard)] : []),
        ...m.odds.map(oddsCard),
      ];
      if (w) {
        const c = el(
          "div",
          PANEL +
            "padding:8px 10px;font-size:13px;" +
            (w.queued
              ? "border:2px solid var(--zw-order);"
              : "border-style:dashed;"),
        );
        c.append(
          line(`Wall off ${w.swarmId}`, "font-weight:600;"),
          ...w.lines.map((t) => line(t)),
          ...(w.reason
            ? [line(`Cannot: ${w.reason}.`, "color:var(--zw-warn);")]
            : []),
        );
        cards.push(c);
      }
      if (f) {
        const parts = [
          f.rising > 0
            ? `Heating up: ${f.rising} ${f.rising === 1 ? "tile" : "tiles"}`
            : "",
          f.slowed.length > 0 ? `Slowed: ${f.slowed.join(", ")}` : "",
        ].filter(Boolean);
        if (parts.length > 0) {
          cards.push(
            line(parts.join(". "), PANEL + "padding:6px 10px;font-size:12px;"),
          );
        }
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
        b.style.outline = pb.speed === s ? "2px solid var(--zw-focus)" : "";
      }
      skip.style.display = pb.playing ? "" : "none";
      replay.style.display = pb.playing ? "none" : "";
      replay.disabled = !pb.canReplay;
      reset.disabled = pb.playing;
      logBox.style.display = m.log.length > 0 ? "block" : "none";
      log.replaceChildren(...m.log.map((t) => line(t)));
    },
    setLive(p) {
      progress.style.width = `${Math.round(p * 100)}%`;
    },
    pulse() {
      logBox.animate(
        [
          {
            boxShadow: "0 0 0 2px var(--zw-heat)",
            background: "rgba(80,48,40,0.9)",
          },
          { boxShadow: "0 0 0 0 transparent" },
        ],
        { duration: 900, easing: "ease-out" },
      );
    },
  };
}
