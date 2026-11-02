import { createInsetView } from "../render/insetView";
import {
  advanceDay,
  findPlaced,
  placeCard,
  setPackPills,
  skipMeds,
  takeMeds,
  todayDose,
  unplaceCard,
  weekOver,
} from "../sim/life/calendar";
import { doctorPreview } from "../sim/life/body";
import { cardDef, versionsOf } from "../sim/life/cards";
import { battleDue, loadoutFromLife } from "../sim/life/loadout";
import { cardPreview, exposurePreview } from "../sim/life/preview";
import type {
  CardId,
  HandCardId,
  LifeEvent,
  LifeState,
  LifeStep,
} from "../sim/life/types";
import { battleFromLoadout } from "../sim/battle/setup";
import { PARAMS } from "../sim/params";
import { cardChoices } from "../sim/score";
import { createDebugPanel } from "../ui/debugPanel";
import { sessionOptions } from "./sessionOptions";
import { createHelp, LIFE_LINES } from "../ui/help";
import {
  aftermathDetail,
  aftermathTitle,
  doctorLines,
  DOCTOR_NUDGE,
  symptomText,
  weekOpening,
} from "./campaignModel";
import type { Run } from "./run";
import {
  createLifePanel,
  type LifePanelModel,
  type LifeSlotModel,
} from "../ui/lifePanel";
import {
  battleOddsText,
  weekEndText,
  doseStrip,
  lifeBeats,
  lifeStatusModel,
  oddsText,
  particleCount,
  pct,
  placementCheck,
  slotName,
  NO_PENDING,
  clearPending,
  selectActivity,
  tapActivity,
  tapSlot,
  type Pending,
  type PickEffect,
  weekPlayStops,
  weekSummary,
} from "./lifeModel";
import { createStatusStrip } from "../ui/statusStrip";
import type { Screen, ScreenEnv } from "./screen";

const L = PARAMS.life;

/** The calendar screen: the body inset on the board canvas, the week planner in the side panel. */
export function mountLife(env: ScreenEnv, run: Run): Screen {
  const { canvas, root, panels, ui } = env;
  document.getElementById("app")?.classList.add("life");
  const ac = new AbortController();
  const { signal } = ac;
  let life: LifeState = run.campaign().life;
  let pending: Pending = NO_PENDING;
  let hover: CardId | null = null;
  let message = "";
  const opening = weekOpening(run.lastEvents());
  let beats: { day: string; lines: string[] }[] =
    run.campaign().cycle > 1 || opening.length > 0
      ? [
          {
            day: `Week ${life.week} begins`,
            lines: [`You start with ${life.energy} energy.`, ...opening],
          },
        ]
      : [];
  const chosen = new Map<HandCardId, CardId>();
  let packed = false;

  // The board only supplies the slab; the life phase puts nothing on it but the preview.
  const slab = battleFromLoadout(loadoutFromLife(life));
  const inset = createInsetView(root, slab);

  // The activity currently picked, if any (the slot half of the pick lives in `pending.slot`).
  const selOf = (): HandCardId | "rest" | null =>
    pending.activity as HandCardId | "rest" | null;
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
  const apply = (fn: (l: LifeState) => LifeStep): LifeEvent[] => {
    try {
      const step = run.life(fn);
      life = run.campaign().life;
      message = "";
      return step.events.flatMap((e) => (e.type === "Life" ? [e.event] : []));
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
      return [];
    }
  };

  const previewCard = (): CardId | null => {
    if (hover) return hover;
    const sel = selOf();
    return sel && sel !== "rest" ? versionOf(sel) : null;
  };

  const caption = document.createElement("div");
  caption.setAttribute("aria-hidden", "true");
  caption.style.cssText =
    "position:absolute;left:10px;right:10px;bottom:8px;pointer-events:none;font:13px sans-serif;" +
    "color:var(--zw-text);text-shadow:0 1px 3px #000;display:flex;flex-direction:column;gap:2px;";
  const capLeft = document.createElement("span");
  const capRight = document.createElement("span");
  caption.append(capLeft, capRight);
  canvas.parentElement?.append(caption);
  canvas.setAttribute("role", "img");

  const showInset = () => {
    inset.setAura(life.medLevel);
    // Only what the doctor found (or a flare) shows; hidden ones stay hidden.
    inset.setReservoirs(life.reservoirs.filter((r) => !r.hidden || r.flared));
    const card = previewCard();
    let label = `Body view: medication shield ${pct(life.medLevel)}.`;
    if (card && !cardDef(card).doctor) {
      const p = cardPreview(life, card);
      const entry = cardDef(card).exposure.at[0] ?? { x: 3, y: 2 };
      inset.setPreview({
        kind: p.kind,
        kinds: p.kinds,
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
    const sel = selOf();
    const week = exposurePreview(life);
    const over = weekOver(life);
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
          pending: pending.slot?.day === day && pending.slot.slot === slot,
          target,
        };
      }),
    );
    const hand = life.hand.map((base) => {
      const version = versionOf(base);
      const pv = cardPreview(life, version);
      const at = placed(base);
      const other = pv.otherVersion ? cardPreview(life, pv.otherVersion) : null;
      const isDoctor = cardDef(version).doctor === true;
      return {
        doctor: isDoctor
          ? doctorLines(doctorPreview(life, at ? at.day : life.day))
          : null,
        base,
        version,
        label: pv.label,
        people: pv.people,
        blurb: pv.blurb,
        points: pv.points,
        energy: pv.energy,
        choices: cardChoices(version).total,
        odds: oddsText(pv.chance, pv.kind),
        chance: pv.chance,
        alt: other
          ? {
              version: other.card,
              text: pv.smarter
                ? `Back to: ${other.label}`
                : `Try instead: ${other.label}`,
              odds: `${oddsText(other.chance, other.kind)} · +${other.points} points · Choices +${cardChoices(other.card).total}`,
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
    const end = weekEndText(due.battleKind, due.reasons, pct(s.medLevel));
    const symptomLines = life.symptoms.map(symptomText);
    const notes: string[] = [];
    if (life.doctor) {
      notes.push(
        life.doctor.finding === "reservoir"
          ? `You saw the doctor (${life.doctor.timing}) and they found something. It goes into the battle out in the open, with strong backup.`
          : `You saw the doctor (${life.doctor.timing}). It was only a virus.`,
      );
    } else if (symptomLines.length > 0) {
      notes.push(
        "Symptoms showed up this week, and you did not see the doctor.",
      );
    }
    const hintBase = pending.slot
      ? `${here(pending.slot.day, pending.slot.slot)} is chosen. Now pick an activity.`
      : sel === "rest"
        ? "Now tap a time slot to clear it for a rest."
        : sel
          ? `Now tap a time slot for ${cardDef(versionOf(sel)).label}.`
          : "Tap an activity, then a time slot. Or tap a time slot first. Tap a planned activity to take it off.";
    return {
      title: over
        ? `Week ${life.week} is done`
        : `Week ${life.week} · Day ${life.day + 1} of ${L.days}`,
      over,
      meds: {
        level: life.medLevel,
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
          : battleOddsText(week.chanceBattle),
      beats,
      summary: over
        ? {
            landed: s.landed.map((x) => x.text),
            dodged: s.dodged,
            medPct: pct(s.medLevel),
            streak: s.streak,
            goalText: `${s.points} of ${s.target} points.`,
            metGoal: s.metGoal,
            notes,
            battle: { due: end.due, line: end.line },
          }
        : null,
      playLabel: life.day === 0 ? "Play the week" : "Play the rest of the week",
      playDayLabel:
        L.days - life.day > 1 ? `Play day ${life.day + 1} only` : null,
      feel: {
        lines: symptomLines,
        nudge:
          life.hand.includes("doctor") && !life.doctor && !over
            ? DOCTOR_NUDGE
            : null,
      },
      endLabel: due.due ? end.button : run.standalone ? "" : end.button,
      aftermath:
        life.aftermath && life.day === 0
          ? {
              title: aftermathTitle(life.aftermath),
              text: aftermathDetail(life.aftermath),
            }
          : null,
      canAgain: run.standalone,
    };
  };

  /** Plays today and logs its beats; null when the day could not be played. */
  function playOneDay(): LifeEvent[] | null {
    const day = life.day;
    const events = apply(() => advanceDay(life));
    if (events.length === 0) return null;
    beats = [
      { day: `Day ${day + 1}`, lines: lifeBeats(events) },
      ...beats,
    ].slice(0, 4);
    return events;
  }

  /** Carries out a place or remove from the pick logic; a refused placement keeps the activity picked. */
  function runEffect(effect: PickEffect | null) {
    if (!effect) return;
    if (effect.type === "remove") {
      apply(() => unplaceCard(life, effect.day, effect.slot));
      return;
    }
    if (effect.activity === "rest") {
      // Rest on a waiting slot just clears it.
      if (life.plan[effect.day][effect.slot])
        apply(() => unplaceCard(life, effect.day, effect.slot));
      return;
    }
    const base = effect.activity as HandCardId;
    if (effect.day < life.day) return;
    const card = versionOf(base);
    const check = placementCheck(
      life,
      effect.day,
      effect.slot,
      card,
      packOf(base),
    );
    if (!check.ok) {
      message = check.reasons[0];
      pending = { activity: base, slot: null };
      return;
    }
    const old = placed(base);
    if (
      old &&
      old.day >= life.day &&
      (old.day !== effect.day || old.slot !== effect.slot)
    ) {
      apply(() => unplaceCard(life, old.day, old.slot));
    }
    apply(() => placeCard(life, effect.day, effect.slot, card, packOf(base)));
  }

  const panel = createLifePanel(panels, {
    onHelp: () => help.open(),
    onPickCard: (base) => {
      const r = tapActivity(pending, base);
      pending = r.pending;
      message = "";
      runEffect(r.effect);
      draw();
      if (selOf() && window.matchMedia("(max-width: 899px)").matches)
        panel.showCalendar();
    },
    onPickRest: () => {
      const r = tapActivity(pending, "rest");
      pending = r.pending;
      message = "";
      runEffect(r.effect);
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
      pending = selectActivity(pending, b);
      draw();
    },
    onPills: (base, on) => {
      const b = base as HandCardId;
      packed = on;
      const at = placed(b);
      if (at && at.day >= life.day)
        apply(() => setPackPills(life, at.day, at.slot, on));
      pending = selectActivity(pending, b);
      draw();
    },
    onSlot: (day, slot) => {
      if (day < life.day) return;
      const occupant = life.plan[day][slot];
      const r = tapSlot(
        pending,
        day,
        slot,
        occupant ? cardDef(occupant.card).base : null,
      );
      pending = r.pending;
      message = "";
      runEffect(r.effect);
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
      // Each day goes through the same advanceDay as the one-day button; only the stop rule is new.
      for (;;) {
        const events = playOneDay();
        if (events === null || weekPlayStops(events) || weekOver(life)) break;
      }
      pending = NO_PENDING;
      draw();
    },
    onPlayDay: () => {
      playOneDay();
      pending = NO_PENDING;
      draw();
    },
    onStartBattle: () => {
      if (run.standalone) {
        env.go({
          mode: "battle",
          battle: battleFromLoadout(loadoutFromLife(life)),
        });
        return;
      }
      run.endWeek();
      env.go(
        run.campaign().mode === "battle"
          ? { mode: "battle", run }
          : { mode: "quiet", run },
      );
    },
    onAgain: () => env.go({ mode: "life" }),
    onPreview: (version) => {
      hover = version as CardId | null;
      showInset();
    },
  });

  const debug = createDebugPanel(panels.scroll, {
    mode: run.standalone ? "life" : "campaign",
    onMode: (m) =>
      env.go(m === "campaign" ? { mode: "campaign" } : { mode: m }),
    scenario: "",
    seed: run.seed,
    session: sessionOptions(run),
  });

  const strip = createStatusStrip(panels.status);
  const earlierScore = () =>
    run.campaign().history.reduce((n, h) => n + h.score.total, 0);

  function draw() {
    strip.update(lifeStatusModel(life, earlierScore()));
    panel.update(model());
    showInset();
  }
  draw();
  help.showFirstTime();

  window.addEventListener(
    "keydown",
    (e) => {
      if (
        e.key === "Escape" &&
        !help.isOpen() &&
        (pending.activity || pending.slot)
      ) {
        pending = clearPending();
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
      strip.clear();
      panels.scroll.replaceChildren();
      panels.bar.replaceChildren();
      ui.replaceChildren();
    },
  };
}
