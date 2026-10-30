import { createInsetView } from "../render/insetView";
import {
  advanceDay,
  energyPlan,
  findPlaced,
  placeCard,
  setPackPills,
  skipMeds,
  takeMeds,
  todayDose,
  unplaceCard,
  weekOver,
  createLife,
} from "../sim/life/calendar";
import { cardDef, versionsOf } from "../sim/life/cards";
import { battleDue, loadoutFromLife } from "../sim/life/loadout";
import { cardPreview, exposurePreview } from "../sim/life/preview";
import type { CardId, HandCardId, LifeState } from "../sim/life/types";
import { battleFromLoadout } from "../sim/battle/setup";
import { PARAMS } from "../sim/params";
import { createDebugPanel } from "../ui/debugPanel";
import { createHelp, LIFE_LINES } from "../ui/help";
import {
  createLifePanel,
  type LifePanelModel,
  type LifeSlotModel,
} from "../ui/lifePanel";
import {
  doseStrip,
  lifeBeats,
  oddsText,
  particleCount,
  pct,
  placementCheck,
  slotName,
  weekSummary,
} from "./lifeModel";
import type { Screen, ScreenEnv } from "./screen";

const L = PARAMS.life;

/** The calendar screen: the body inset on the board canvas, the week planner in the side panel. */
export function mountLife(env: ScreenEnv): Screen {
  const { canvas, root, panels, ui } = env;
  document.getElementById("app")?.classList.add("life");
  const ac = new AbortController();
  const { signal } = ac;
  const params = new URLSearchParams(window.location.search);
  const seedParam = Number(params.get("seed"));
  const seed =
    params.get("seed") !== null && Number.isFinite(seedParam)
      ? seedParam
      : PARAMS.defaultSeed;

  let life: LifeState = createLife({ seed });
  let sel: HandCardId | "rest" | null = null;
  let hover: CardId | null = null;
  let message = "";
  let beats: { day: string; lines: string[] }[] = [];
  const chosen = new Map<HandCardId, CardId>();
  let packed = false;

  // The board only supplies the slab; the life phase puts nothing on it but the preview.
  const slab = battleFromLoadout(loadoutFromLife(life));
  const inset = createInsetView(root, slab);

  const placed = (base: HandCardId) => findPlaced(life, base);
  const versionOf = (base: HandCardId): CardId =>
    placed(base)?.placement.card ?? chosen.get(base) ?? base;
  const packOf = (base: HandCardId): boolean =>
    placed(base)?.placement.packPills ?? packed;
  const here = (day: number, slot: number) =>
    `Day ${day + 1} ${slotName(slot).toLowerCase()}`;

  const help = createHelp(ui, {
    lines: LIFE_LINES,
    seenKey: "zebrawars.help.life.seen",
  });
  const apply = (fn: () => { state: LifeState }) => {
    try {
      life = fn().state;
      message = "";
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
  };

  const previewCard = (): CardId | null => {
    if (hover) return hover;
    return sel && sel !== "rest" ? versionOf(sel) : null;
  };

  const caption = document.createElement("div");
  caption.setAttribute("aria-hidden", "true");
  caption.style.cssText =
    "position:absolute;left:10px;right:10px;bottom:8px;pointer-events:none;font:13px sans-serif;" +
    "color:#e4e7ee;text-shadow:0 1px 3px #000;display:flex;flex-direction:column;gap:2px;";
  const capLeft = document.createElement("span");
  const capRight = document.createElement("span");
  caption.append(capLeft, capRight);
  canvas.parentElement?.append(caption);
  canvas.setAttribute("role", "img");

  const showInset = () => {
    inset.setAura(life.medLevel);
    inset.setReservoirs(life.reservoirs);
    const card = previewCard();
    let label = `Body view: medication shield ${pct(life.medLevel)}.`;
    if (card) {
      const p = cardPreview(life, card);
      const entry = cardDef(card).exposure.at[0] ?? { x: 3, y: 2 };
      inset.setPreview({
        kind: p.kind,
        count: particleCount(p.expectedPathogens),
        entry,
      });
      capRight.textContent = `${p.label}: ${oddsText(p.chance, p.kind)}`;
      label += ` Previewing ${p.label}: ${oddsText(p.chance, p.kind)}.`;
    } else {
      inset.setPreview(null);
      capRight.textContent = "";
    }
    capLeft.textContent = `Medication ${pct(life.medLevel)}`;
    canvas.setAttribute("aria-label", label);
  };

  const model = (): LifePanelModel => {
    const week = exposurePreview(life);
    const over = weekOver(life);
    const energyRows = energyPlan(life).flat();
    const dose = todayDose(life);
    const strip = doseStrip(life);
    const lost = week.frictionDays;
    const noteParts: string[] = [];
    if (lost.length > 0) {
      noteParts.push(
        `Day ${lost.map((d) => d + 1).join(", ")}'s dose will be missed: the pills are in the other bag. ` +
          `Medication level ends the week at ${pct(week.medLevel)}.`,
      );
    }
    const grid = Array.from({ length: L.days }, (_, day) =>
      Array.from({ length: L.slotsPerDay }, (_, slot): LifeSlotModel => {
        const p = life.plan[day][slot];
        const base = sel && sel !== "rest" ? sel : null;
        const played = day < life.day;
        let target: LifeSlotModel["target"] = null;
        if (base && !played) {
          const c = placementCheck(
            life,
            day,
            slot,
            versionOf(base),
            packOf(base),
          );
          target = { ok: c.ok, reason: c.reasons[0] ?? "" };
        }
        return {
          day,
          slot,
          name: slotName(slot),
          card: p
            ? {
                label: cardDef(p.card).label,
                points: cardDef(p.card).points,
                pills: cardDef(p.card).overnight
                  ? p.packPills
                    ? "packed"
                    : "left"
                  : null,
              }
            : null,
          played,
          today: day === life.day,
          target,
        };
      }),
    );
    const hand = life.hand.map((base) => {
      const version = versionOf(base);
      const pv = cardPreview(life, version);
      const at = placed(base);
      const other = pv.otherVersion ? cardPreview(life, pv.otherVersion) : null;
      return {
        base,
        version,
        label: pv.label,
        people: pv.people,
        blurb: pv.blurb,
        points: pv.points,
        energy: pv.energy,
        odds: oddsText(pv.chance, pv.kind),
        chance: pv.chance,
        alt: other
          ? {
              version: other.card,
              text: pv.smarter
                ? `Back to: ${other.label}`
                : `Try instead: ${other.label}`,
              odds: `${oddsText(other.chance, other.kind)} · +${other.points} points`,
            }
          : null,
        pills: pv.friction
          ? { packed: packOf(base), extra: pv.friction.packPillsEnergy }
          : null,
        placedAt: at ? here(at.day, at.slot) : null,
        selected: sel === base,
        played: !!at && at.day < life.day,
      };
    });
    const due = battleDue(life);
    const s = weekSummary(life);
    const reservoir = due.reasons.includes("reservoir");
    const hintBase =
      sel === "rest"
        ? "Tap a slot to clear it for a rest."
        : sel
          ? `Tap a slot for ${cardDef(versionOf(sel)).label}.`
          : "Tap a card, then a slot. Tap a planned card to take it off.";
    return {
      title: over
        ? `Week ${life.week} is done`
        : `Week ${life.week} · Day ${life.day + 1} of ${L.days}`,
      over,
      goal: {
        points: life.goal.points,
        planned: week.points.planned,
        target: life.goal.target,
      },
      energy: {
        now: life.energy,
        end: energyRows.length
          ? energyRows[energyRows.length - 1]
          : life.energy,
        max: L.maxEnergy,
      },
      meds: {
        level: life.medLevel,
        pct: pct(life.medLevel),
        streak: life.streak,
        dose: over
          ? "over"
          : !dose
            ? "open"
            : dose.cause === "friction"
              ? "lost"
              : dose.taken
                ? "taken"
                : "skipped",
        strip,
        note: noteParts.join(" "),
      },
      hint: message ? `Can't do that: ${message}` : hintBase,
      restSelected: sel === "rest",
      hand,
      grid,
      odds: over
        ? ""
        : week.pending.length === 0
          ? "Nothing planned yet."
          : `With this plan, the chance this week ends in a battle is ${pct(week.chanceBattle)}.`,
      beats,
      summary: over
        ? {
            landed: s.landed.map((x) => x.text),
            dodged: s.dodged,
            medPct: pct(s.medLevel),
            streak: s.streak,
            goalText: `${s.points} of ${s.target} points.`,
            metGoal: s.metGoal,
            battle: due.due
              ? {
                  due: true,
                  line:
                    reservoir && !due.reasons.includes("exposure")
                      ? "Something left over is flaring up. A battle is next."
                      : "Something came home with you. A battle is next, with your medication at " +
                        pct(s.medLevel) +
                        ".",
                }
              : {
                  due: false,
                  line: "Quiet week. Nothing landed, so there is nothing to fight. Enjoy it.",
                },
          }
        : null,
      playLabel:
        life.day === 0 ? "Play day 1" : `Next day: play day ${life.day + 1}`,
    };
  };

  const panel = createLifePanel(panels, {
    onHelp: () => help.open(),
    onPickCard: (base) => {
      sel = sel === base ? null : (base as HandCardId);
      message = "";
      draw();
      if (sel && window.matchMedia("(max-width: 899px)").matches)
        panel.showCalendar();
    },
    onPickRest: () => {
      sel = sel === "rest" ? null : "rest";
      message = "";
      draw();
    },
    onSwap: (base) => {
      const b = base as HandCardId;
      const [first, second] = versionsOf(b);
      const next = versionOf(b) === first ? second : first;
      chosen.set(b, next);
      const at = placed(b);
      if (at && at.day >= life.day) {
        apply(() =>
          placeCard(life, at.day, at.slot, next, at.placement.packPills),
        );
      }
      draw();
    },
    onPills: (base, on) => {
      const b = base as HandCardId;
      packed = on;
      const at = placed(b);
      if (at && at.day >= life.day)
        apply(() => setPackPills(life, at.day, at.slot, on));
      draw();
    },
    onSlot: (day, slot) => {
      if (day < life.day) return;
      const occupant = life.plan[day][slot];
      if (!sel || sel === "rest") {
        if (occupant) apply(() => unplaceCard(life, day, slot));
        else if (!sel) message = "";
        sel = null;
        draw();
        return;
      }
      const card = versionOf(sel);
      if (occupant && cardDef(occupant.card).base === sel) {
        apply(() => unplaceCard(life, day, slot));
        sel = null;
        draw();
        return;
      }
      const check = placementCheck(life, day, slot, card, packOf(sel));
      if (!check.ok) {
        message = check.reasons[0];
        draw();
        return;
      }
      const old = placed(sel);
      if (
        old &&
        old.day >= life.day &&
        (old.day !== day || old.slot !== slot)
      ) {
        apply(() => unplaceCard(life, old.day, old.slot));
      }
      apply(() => placeCard(life, day, slot, card, packOf(sel as HandCardId)));
      sel = null;
      draw();
    },
    onTakeMeds: () => {
      apply(() => takeMeds(life));
      draw();
    },
    onSkipMeds: () => {
      apply(() => skipMeds(life));
      draw();
    },
    onPlay: () => {
      const day = life.day;
      let events: Parameters<typeof lifeBeats>[0] = [];
      apply(() => {
        const step = advanceDay(life);
        events = step.events;
        return step;
      });
      beats = [
        { day: `Day ${day + 1}`, lines: lifeBeats(events) },
        ...beats,
      ].slice(0, 3);
      sel = null;
      draw();
    },
    onStartBattle: () =>
      env.go({
        mode: "battle",
        battle: battleFromLoadout(loadoutFromLife(life)),
      }),
    onAgain: () => {
      life = createLife({ seed });
      sel = null;
      beats = [];
      chosen.clear();
      packed = false;
      message = "";
      draw();
    },
    onPreview: (version) => {
      hover = version as CardId | null;
      showInset();
    },
  });

  const debug = createDebugPanel(panels.scroll, {
    mode: "life",
    onMode: (m) => env.go({ mode: m }),
    scenario: "",
    seed,
  });

  function draw() {
    panel.update(model());
    showInset();
  }
  draw();
  help.showFirstTime();

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && !help.isOpen() && sel) {
        sel = null;
        draw();
      }
    },
    { signal },
  );

  return {
    setStats: (text) => debug.setStats(text),
    tick: (dt) => inset.tick(dt),
    dispose() {
      ac.abort();
      document.getElementById("app")?.classList.remove("life");
      help.dispose();
      inset.dispose();
      caption.remove();
      canvas.removeAttribute("role");
      canvas.removeAttribute("aria-label");
      panels.scroll.replaceChildren();
      panels.bar.replaceChildren();
      ui.replaceChildren();
    },
  };
}
