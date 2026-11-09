import { createInsetView } from "../render/insetView";
import {
  advanceDay,
  findPlaced,
  placeCard,
  setPackPills,
  setDose,
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
import { createGameMenu } from "../ui/gameMenu";
import { facilitator, resetForNewPlayer } from "./facilitator";
import { createHelp, LIFE_LINES, LIFE_SEEN_KEY } from "../ui/help";
import {
  aftermathDetail,
  aftermathTitle,
  doctorLines,
  DOCTOR_NUDGE,
  symptomText,
  weekOpening,
} from "./campaignModel";
import {
  escapeAction,
  leaveNote,
  menuItems,
  whereLines,
} from "./gameMenuModel";
import { backAction } from "./navGuardModel";
import type { Run } from "./run";
import {
  createLifePanel,
  type LifePanelModel,
  type LifeSlotModel,
} from "../ui/lifePanel";
import {
  scoreLine,
  luckLine,
  weekEndText,
  weekOdds,
  doseStrip,
  lifeBeats,
  lifeStatusModel,
  exposureShift,
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
  stopBanner,
  earliestDoctorSlot,
  type StopBanner,
  weekSummary,
} from "./lifeModel";
import { createStatusStrip } from "../ui/statusStrip";
import type { Screen, ScreenEnv } from "./screen";

const L = PARAMS.life;

/**
 * What the week screen shows that the Run does not hold, kept when the screen is left so Continue
 * finds the week as it was. A picked activity or slot is not kept (a pick is easy to redo).
 */
interface KeptView {
  readonly cycle: number;
  readonly beats: { day: string; lines: string[] }[];
  readonly banner: StopBanner | null;
  readonly bookNote: string;
  readonly chosen: readonly [HandCardId, CardId][];
  readonly packed: boolean;
}
const kept = new WeakMap<Run, KeptView>();

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
  const back = kept.get(run);
  const restore = back && back.cycle === run.campaign().cycle ? back : null;
  let banner: StopBanner | null = restore?.banner ?? null;
  let bookNote = restore?.bookNote ?? "";
  const opening = weekOpening(run.lastEvents());
  let beats: { day: string; lines: string[] }[] = restore
    ? restore.beats
    : run.campaign().cycle > 1 || opening.length > 0
      ? [
          {
            day: `Week ${life.week} begins`,
            lines: [`You start with ${life.energy} energy.`, ...opening],
          },
        ]
      : [];
  const chosen = new Map<HandCardId, CardId>(restore?.chosen ?? []);
  let packed = restore?.packed ?? false;

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
    seenKey: LIFE_SEEN_KEY,
  });
  // The debug standalone entry has no title to go back to, so no menu.
  const menu = run.standalone
    ? null
    : createGameMenu(ui, {
        where: whereLines({
          arc: run.arc,
          variant: run.variant,
          week: {
            cycle: run.campaign().cycle,
            cycles: run.campaign().cycles,
          },
        }),
        leaveNote: leaveNote(run.arc),
        arc: run.arc,
        items: () =>
          menuItems({ arc: run.arc, screen: "life", fightOver: false }),
        on: {
          help: () => help.open(),
          restartFight: () => {},
          // A new run with the same seed, held in place of this one (as the arc picker starts it).
          restartSummer: () =>
            env.go({
              mode: "arcPlay",
              arc: run.arc,
              variant: run.variant,
              seed: run.seed,
            }),
          chooseArc: () => {
            run.ui("leave", "to the arc list");
            env.go({ mode: "arcs", variant: run.variant });
          },
          changeCharacter: () => {
            run.ui("leave", "to the title");
            env.go({ mode: "title" });
          },
        },
        facilitator: facilitator.on
          ? {
              session: sessionOptions(run),
              reset: resetForNewPlayer,
              toTitle: () => env.go({ mode: "title" }),
            }
          : undefined,
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
      label += ` Previewing ${p.label}: ${oddsText(p.chance, p.kinds)}.`;
    } else {
      inset.setPreview(null);
    }
    canvas.setAttribute("aria-label", label);
  };

  // The picked card to preview in the Exposure cell: an activity with no slot yet (not rest, not the doctor).
  const pickCard = (): CardId | null => {
    const sel = selOf();
    if (!sel || sel === "rest" || pending.slot) return null;
    const v = versionOf(sel);
    return cardDef(v).doctor ? null : v;
  };
  const pickShift = (): string => {
    const v = pickCard();
    return v ? ` ${exposureShift(life, v).text}` : "";
  };

  const model = (): LifePanelModel => {
    const sel = selOf();
    const week = exposurePreview(life);
    const over = weekOver(life);
    const strip = doseStrip(life);
    const lost = week.frictionDays;
    const noteParts: string[] = [];
    if (lost.length > 0) {
      noteParts.push(
        `Day ${lost.map((d) => d + 1).join(", ")}'s dose will be missed: pills at home. ` +
          `Level ends at ${pct(week.medLevel)}.`,
      );
    }
    for (const s of week.slipDays) {
      noteParts.push(
        `Day ${s.day + 1}: late night, ${pct(s.chance)} the pills slip. "Game night, home by 11" removes it.`,
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
                version: p.card,
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
        facts: scoreLine(pv.points, pv.energy, cardChoices(version).total),
        odds: oddsText(pv.chance, pv.kinds),
        chance: pv.chance,
        doseRisk: pv.doseRisk ? pv.doseRisk.text : null,
        alt: other
          ? {
              version: other.card,
              text: pv.smarter
                ? `Back to: ${other.label}`
                : `Try instead: ${other.label}`,
              odds: `${oddsText(other.chance, other.kinds)}. ${scoreLine(other.points, other.energy, cardChoices(other.card).total)}${pv.doseRisk && !other.doseRisk ? ". No late night, the pills stay on routine" : ""}`,
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
          ? `Now tap a time slot for ${cardDef(versionOf(sel)).label}.${pickShift()}`
          : "";
    return {
      title: over
        ? `Week ${life.week} is done`
        : `Week ${life.week} · Day ${life.day + 1} of ${L.days}`,
      over,
      meds: {
        level: life.medLevel,
        streak: life.streak,
        strip,
        note: noteParts.join(" "),
      },
      hint: message ? `Can't do that: ${message}` : hintBase,
      help: "Tap an activity, then a time slot. Or tap a time slot first. Tap a planned activity to take it off.",
      restSelected: sel === "rest",
      hand,
      grid,
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
            luck: luckLine(weekOdds(life), due.reasons.includes("exposure"), {
              flared: due.reasons.includes("reservoir"),
              doctorFound: due.reasons.includes("doctor"),
            }),
            battle: { due: end.due, line: end.line },
          }
        : null,
      playLabel: life.day === 0 ? "Play the week" : "Play the rest of the week",
      playDayLabel:
        L.days - life.day > 1 ? `Play day ${life.day + 1} only` : null,
      feel: {
        lines: symptomLines,
        nudge:
          life.hand.includes("doctor") &&
          !life.doctor &&
          !over &&
          !canBookBanner()
            ? DOCTOR_NUDGE
            : null,
      },
      banner:
        banner && !over
          ? {
              text: banner.text,
              canBook: canBookBanner(),
              note: bookNote,
            }
          : null,
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

  const clearBanner = () => {
    banner = null;
    bookNote = "";
  };
  const canBookBanner = () =>
    banner?.kind === "symptom" &&
    life.hand.includes("doctor") &&
    !life.doctor &&
    !placed("doctor");

  /** Plays days until something needs a decision; shows why it stopped. */
  function playWeek() {
    // Each day goes through the same advanceDay as the one-day button; only the stop rule is new.
    for (;;) {
      const events = playOneDay();
      if (events === null || weekOver(life)) break;
      if (weekPlayStops(events)) {
        banner = stopBanner(events, !placed("doctor") && !life.doctor);
        break;
      }
    }
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
      clearBanner();
      const r = tapActivity(pending, base);
      pending = r.pending;
      message = "";
      runEffect(r.effect);
      draw();
    },
    onPickRest: () => {
      clearBanner();
      const r = tapActivity(pending, "rest");
      pending = r.pending;
      message = "";
      runEffect(r.effect);
      draw();
    },
    onSwap: (base) => {
      clearBanner();
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
      // A placed card stays placed; only an unplaced one becomes the pick.
      pending = at ? NO_PENDING : selectActivity(pending, b);
      draw();
    },
    onPills: (base, on) => {
      clearBanner();
      const b = base as HandCardId;
      packed = on;
      const at = placed(b);
      if (at && at.day >= life.day)
        apply(() => setPackPills(life, at.day, at.slot, on));
      pending = at ? NO_PENDING : selectActivity(pending, b);
      draw();
    },
    onSlot: (day, slot) => {
      clearBanner();
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
    onPlay: () => {
      clearBanner();
      playWeek();
      pending = NO_PENDING;
      draw();
    },
    onPlayDay: () => {
      clearBanner();
      playOneDay();
      pending = NO_PENDING;
      draw();
    },
    onPlayOn: () => {
      clearBanner();
      playWeek();
      draw();
    },
    onBookDoctor: () => {
      const at = earliestDoctorSlot(life);
      if (!at) {
        bookNote =
          "The doctor needs an empty slot with enough energy, and none is free. Clear a slot in your week, then tap the doctor card.";
        draw();
        return;
      }
      apply(() => placeCard(life, at.day, at.slot, "doctor"));
      clearBanner();
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

  const debug = !facilitator.debugPanel
    ? null
    : createDebugPanel(panels.scroll, {
        mode: run.standalone ? "life" : "campaign",
        onMode: (m) =>
          env.go(m === "campaign" ? { mode: "campaign" } : { mode: m }),
        scenario: "",
        seed: run.seed,
        session: sessionOptions(run),
        // Demo and test only: the player UI has no way to skip a dose.
        forceMiss: {
          days: L.days,
          onForce: (day) => {
            clearBanner();
            apply(() => setDose(life, day, false));
            draw();
          },
        },
      });

  const strip = createStatusStrip(panels.status);
  const earlierScore = () =>
    run.campaign().history.reduce((n, h) => n + h.score.total, 0);

  function draw() {
    strip.update(lifeStatusModel(life, earlierScore(), pickCard()));
    panel.update(model());
    showInset();
  }
  draw();
  help.showFirstTime();

  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      const act = escapeAction({
        menuOpen: false,
        // Help closes itself on this same Escape (it calls preventDefault), so skip then too.
        otherOpen: help.isOpen() || e.defaultPrevented || menu === null,
        pick: !!(pending.activity || pending.slot),
      });
      if (act === "cancelPick") {
        pending = clearPending();
        draw();
      } else if (act === "openMenu") menu?.open();
    },
    { signal },
  );

  return {
    setStats: (text) => debug?.setStats(text),
    tick: (dt) => inset.tick(dt),
    back: menu
      ? () => {
          const act = backAction({
            menuOpen: menu.isOpen(),
            helpOpen: help.isOpen(),
            blocked: false,
          });
          if (act === "openMenu") menu.open();
          else if (act === "closeMenu") menu.close();
          else if (act === "closeHelp") help.close();
        }
      : undefined,
    dispose() {
      ac.abort();
      kept.set(run, {
        cycle: run.campaign().cycle,
        beats,
        banner,
        bookNote,
        chosen: [...chosen],
        packed,
      });
      document.getElementById("app")?.classList.remove("life");
      help.dispose();
      menu?.dispose();
      inset.dispose();
      canvas.removeAttribute("role");
      canvas.removeAttribute("aria-label");
      strip.clear();
      panels.scroll.replaceChildren();
      panels.bar.replaceChildren();
      ui.replaceChildren();
    },
  };
}
