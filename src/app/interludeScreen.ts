import { createInsetView } from "../render/insetView";
import { battleFromLoadout } from "../sim/battle/setup";
import { campaignSummary, carryPreview } from "../sim/campaign";
import { PARAMS } from "../sim/params";
import { loadoutFromLife } from "../sim/life/loadout";
import { createDebugPanel } from "../ui/debugPanel";
import { createGameMenu } from "../ui/gameMenu";
import { facilitator, resetForNewPlayer } from "./facilitator";
import { createHelp, LIFE_LINES, LIFE_SEEN_KEY } from "../ui/help";
import { createInterlude, type InterludeModel } from "../ui/interlude";
import { bestId, recordRun, type RecordResult } from "./bestScores";
import { completeButtons } from "./arcModel";
import { scoreCard } from "./summaryModel";
import { weekLine } from "./campaignModel";
import {
  escapeAction,
  leaveNote,
  menuItems,
  whereLines,
} from "./gameMenuModel";
import { backAction } from "./navGuardModel";
import type { Run } from "./run";
import type { Screen, ScreenEnv } from "./screen";
import { sessionOptions } from "./sessionOptions";

/** Each finished run is recorded once, however often its summary is mounted. */
const recorded = new WeakMap<Run, RecordResult>();

function recordOnce(run: Run, total: number, choices: number, outcome: number) {
  const done = recorded.get(run);
  if (done) return done;
  const c = run.campaign();
  const id = bestId({
    scoreVersion: c.history[0]?.score.version ?? PARAMS.score.version,
    arc: run.arc,
    variant: run.variant,
    seed: run.seed,
  });
  const rec = recordRun(id, { total, choices, outcome });
  recorded.set(run, rec);
  return rec;
}

/** The beats between weeks that have no board: a viral week, and the campaign summary. */
export function mountInterlude(
  env: ScreenEnv,
  run: Run,
  kind: "quiet" | "summary",
): Screen {
  const { root, panels, ui } = env;
  document.getElementById("app")?.classList.add("life");
  const c = run.campaign();
  const slab = battleFromLoadout(loadoutFromLife(c.life));
  const inset = createInsetView(root, slab);
  inset.setAura(c.life.medLevel);
  const card = createInterlude(ui);
  const help = createHelp(ui, {
    lines: LIFE_LINES,
    seenKey: LIFE_SEEN_KEY,
  });
  const menu = createGameMenu(ui, {
    where: whereLines({
      arc: run.arc,
      variant: run.variant,
      week: { cycle: c.cycle, cycles: c.cycles },
    }),
    leaveNote: leaveNote(run.arc, kind === "summary"),
    arc: run.arc,
    items: () =>
      menuItems({ arc: run.arc, screen: "interlude", fightOver: false }),
    on: {
      help: () => help.open(),
      restartFight: () => {},
      restartSummer: () => {},
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
  const ac = new AbortController();
  // Nothing here to cancel, so Escape opens the menu.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") return;
      const act = escapeAction({
        menuOpen: false,
        otherOpen: help.isOpen() || e.defaultPrevented,
        pick: false,
      });
      if (act === "openMenu") menu.open();
    },
    { signal: ac.signal },
  );

  const debug = !facilitator.debugPanel
    ? null
    : createDebugPanel(panels.scroll, {
        mode: "campaign",
        onMode: (m) =>
          env.go(m === "campaign" ? { mode: "campaign" } : { mode: m }),
        scenario: "",
        seed: run.seed,
        session: sessionOptions(run),
      });

  let model: InterludeModel;
  if (kind === "quiet") {
    const carry = carryPreview(c);
    const last = c.cycle >= c.cycles;
    model = {
      title: "Just a virus",
      lead: "The doctor says it was only a virus, and nothing else came home with you. No fight this week. Rest up.",
      notes: [
        `You get a breather: energy goes from ${carry.energy.left} to ${carry.energy.next} for ${last ? "the days after" : "next week"}.`,
      ],
      groups: [],
      buttons: [
        {
          label: last ? "See your summary" : `Start week ${c.life.week + 1}`,
          primary: true,
          onClick: () => {
            run.next();
            env.go(
              run.campaign().mode === "done"
                ? { mode: "summary", run }
                : { mode: "life", run },
            );
          },
        },
      ],
    };
  } else {
    const sum = campaignSummary(c);
    const g = sum.grades;
    const battles = g.cleared + g.contained + g.neededBackup;
    const sk = sum.skirmishes;
    const skirmishes = sk.cleared + sk.loose;
    const s = sum.score;
    const rec = recordOnce(run, s.total, s.choices, s.outcome);
    model = {
      title: `Your ${c.cycles} weeks: ${s.total}`,
      score: scoreCard(c.history, c.cycles, s, rec),
      lead:
        `${sum.points} points across ${sum.weeks} weeks (${sum.goalsMet} goal${sum.goalsMet === 1 ? "" : "s"} met). ` +
        `${battles} ${battles === 1 ? "battle" : "battles"}, ${skirmishes} ${skirmishes === 1 ? "skirmish" : "skirmishes"}` +
        (sum.quietWeeks > 0 ? `, ${sum.quietWeeks} virus-only.` : "."),
      notes: [
        `Battles: ${g.cleared} all clear, ${g.contained} contained, ${g.neededBackup} needed backup. ` +
          `Skirmishes: ${sk.cleared} cleared, ${sk.loose} left something stirring. ` +
          `Doctor visits: ${sum.doctorVisits}${sum.earlyVisits > 0 ? ` (${sum.earlyVisits} early)` : ""}. ` +
          (sum.reservoirsLeft > 0
            ? `${sum.reservoirsLeft} still carried over at the end, and could show up as symptoms.`
            : "Nothing carried over at the end."),
      ],
      groups: c.history.map((h) => {
        const w = weekLine(h);
        return {
          head: `Week ${w.week}: ${w.points}`,
          lines: [w.result, w.doctor, w.carried],
        };
      }),
      buttons: completeButtons(run.arc, run.variant, run.seed).map((b, i) => ({
        label: b.label,
        primary: i === 0,
        onClick: () => env.go(b.to),
      })),
    };
  }
  card.show(model);

  return {
    setStats: (text) => debug?.setStats(text),
    tick: (dt) => inset.tick(dt),
    back() {
      const act = backAction({
        menuOpen: menu.isOpen(),
        helpOpen: help.isOpen(),
        blocked: false,
      });
      if (act === "openMenu") menu.open();
      else if (act === "closeMenu") menu.close();
      else if (act === "closeHelp") help.close();
    },
    dispose() {
      document.getElementById("app")?.classList.remove("life");
      ac.abort();
      menu.dispose();
      help.dispose();
      card.dispose();
      inset.dispose();
      panels.scroll.replaceChildren();
      panels.bar.replaceChildren();
      ui.replaceChildren();
    },
  };
}
