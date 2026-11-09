import { createBoardView } from "../render/boardView";
import { createFxView } from "../render/fxView";
import { createGranulomaView } from "../render/granulomaView";
import { createOrderView } from "../render/orderView";
import { organismName } from "../sim/organisms";
import { createPathogenView } from "../render/pathogenView";
import type { Playback } from "../render/playback";
import { createPlaybackView } from "../render/playbackView";
import { createSwarmView } from "../render/swarmView";
import { createTelegraphView } from "../render/telegraphView";
import { createAuraView } from "../render/auraView";
import { battleFromLoadout } from "../sim/battle/setup";
import {
  DEFAULT_SCENARIO,
  defaultSeedFor,
  isScenarioName,
} from "../sim/scenarios";
import { stallChance } from "../sim/battle/intents";
import { battleStatus } from "../sim/battle/outcome";
import { PATHOGEN_KINDS, type PathogenKindId } from "../sim/pathogens";

const PATHOGEN_ORDER = Object.keys(PATHOGEN_KINDS) as PathogenKindId[];
import type { BattleState, ChargeKind, Coord } from "../sim/types";
import type { Screen, ScreenEnv } from "./screen";
import { carryPreview, type Campaign } from "../sim/campaign";
import { battleDueReasons } from "../sim/life/calendar";
import { createBroughtStrip } from "../ui/broughtStrip";
import { createProbe } from "../ui/probe";
import {
  broughtItems,
  probeDue,
  reasonText,
  SKIRMISH_HEADING,
} from "./campaignModel";
import { settings, type Run } from "./run";
import { sessionOptions } from "./sessionOptions";
import { createDebugPanel } from "../ui/debugPanel";
import { createGameMenu } from "../ui/gameMenu";
import { facilitator, resetForNewPlayer } from "./facilitator";
import { createHelp } from "../ui/help";
import { createHud } from "../ui/hud";
import { createMenu } from "../ui/menu";
import {
  compareRows,
  partAReadings,
  partAResult,
  partAStoryCard,
  partBSummary,
  readingsBlock,
  SKIPPED_LINE,
  type PartAReadings,
  type TutorialPart,
} from "./tutorialModel";
import { incomingKey, nextArrival } from "./arrivalModel";
import {
  escapeAction,
  leaveNote,
  menuItems,
  whereLines,
} from "./gameMenuModel";
import { backAction } from "./navGuardModel";
import { arcById, type ArcId, type VariantId } from "./arcs";
import { createStatusStrip } from "../ui/statusStrip";
import { createCoachStrip } from "../ui/coachStrip";
import {
  advanceCoach,
  coachMark,
  coachMode,
  dismissCoach,
  START_COACH,
  type CoachInput,
  type CoachMark,
  type CoachState,
} from "./coachModel";
import { weekChoices, weekScore } from "../sim/score";
import { thisWeekRows } from "./summaryModel";
import { luckLine, medDoses, stillHardLine, weekOdds } from "./lifeModel";
import { battleStatusModel, type BattleStatusInput } from "./battleModel";
import { createOutcomeOverlay, type OutcomeExtra } from "../ui/outcome";
import {
  createController,
  describeOrder,
  describeSupport,
  logLines,
} from "./controller";
import { endTurnHint, heatKey, orderCount } from "./info";
import {
  loadoutFor,
  parseLoadoutParams,
  writeLoadoutParams,
  type LoadoutOptions,
} from "./loadoutOptions";

/** The battle screen: the board canvas, the orders panel and the turn controls. */
export function mountBattle(
  env: ScreenEnv,
  given?: BattleState,
  run?: Run,
  /** An arc's single battle: where "Next" goes once the fight is over. */
  arcEnd?: {
    readonly label: string;
    readonly onDone: () => void;
    readonly arc: ArcId;
    readonly variant: VariantId;
    /** Arc 1: which part this is. Part A ends on a story card, not the outcome card. */
    readonly part?: TutorialPart;
    /** Arc 1, part B: what part A ended on (kept in memory by the runner), absent if skipped. */
    readonly before?: PartAReadings;
    /** Arc 1, part A: told its readings when the fight ends, for part B's table. */
    readonly onReadings?: (readings: PartAReadings) => void;
  },
): Screen {
  // In a campaign the Campaign owns the battle; the controller plays it and hands it back.
  const start = run ? (run.campaign().battle ?? undefined) : given;
  const { canvas, camera, root: scene, ui, panels } = env;
  const ac = new AbortController();
  const { signal } = ac;

  // Arc 1 teaches less: no first-time How to play, no wall off, a quieter side panel and outcome.
  const tutorial = arcEnd?.part !== undefined;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("scenario") ?? DEFAULT_SCENARIO;
  if (!isScenarioName(requested)) {
    console.warn(
      `Unknown scenario "${requested}", using "${DEFAULT_SCENARIO}"`,
    );
  }
  const seedParam = params.get("seed");
  const seed = seedParam === null ? undefined : Number(seedParam);
  if (seed !== undefined && !Number.isFinite(seed)) {
    console.warn(`Invalid seed "${seedParam}", using the default`);
  }
  const scenarioName = isScenarioName(requested) ? requested : DEFAULT_SCENARIO;
  let validSeed =
    seed !== undefined && Number.isFinite(seed) ? seed : undefined;
  let loadoutOptions: LoadoutOptions = parseLoadoutParams(params);
  const load = () =>
    start ??
    battleFromLoadout(
      loadoutFor(
        scenarioName,
        validSeed ?? defaultSeedFor(scenarioName),
        loadoutOptions,
      ),
    );

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controller = createController(load, () => refresh(), {
    reducedMotion: motionQuery.matches,
    walls: !tutorial,
  });
  motionQuery.addEventListener(
    "change",
    (e) => controller.setReducedMotion(e.matches),
    { signal },
  );
  const state = controller.state();

  const { board } = state;
  const view = createBoardView(scene, state);
  const auraView = createAuraView(scene, {
    width: board.width,
    depth: board.height,
  });
  const pathogenView = createPathogenView(scene, view.tilePosition);
  const granulomaView = createGranulomaView(scene, view.tilePosition);
  const swarmView = createSwarmView(scene, view.tilePosition);
  const telegraphView = createTelegraphView(scene, view.tilePosition);
  const orderView = createOrderView(scene, view.tilePosition);
  const fxView = createFxView(scene);
  const playbackView = createPlaybackView({
    board: view,
    swarms: swarmView,
    pathogens: pathogenView,
    granulomas: granulomaView,
    fx: fxView,
    tilePosition: view.tilePosition,
  });
  const help = createHelp(ui);
  // The debug standalone battle has no title to go back to, so no menu.
  const inPlay = run
    ? {
        arc: run.arc,
        variant: run.variant,
        week: {
          cycle: run.campaign().cycle,
          cycles: run.campaign().cycles,
        },
      }
    : arcEnd;
  const menu = inPlay
    ? createGameMenu(ui, {
        where: whereLines(
          arcEnd?.part && !run ? { ...inPlay, part: arcEnd.part } : inPlay,
        ),
        leaveNote: leaveNote(inPlay.arc),
        arc: inPlay.arc,
        items: () =>
          menuItems({
            arc: inPlay.arc,
            screen: "battle",
            fightOver: controller.over(),
          }),
        on: {
          help: () => help.open(),
          restartFight: () => restartFight(),
          restartSummer: () => {
            // A new run with the same seed, held in place of this one (as the arc picker starts it).
            if (run)
              env.go({
                mode: "arcPlay",
                arc: run.arc,
                variant: run.variant,
                seed: run.seed,
              });
          },
          // The held run restarts this fight at turn 1 on Continue; the log says so.
          chooseArc: () => {
            run?.ui("leave", "to the arc list");
            env.go({ mode: "arcs", variant: inPlay.variant });
          },
          changeCharacter: () => {
            run?.ui("leave", "to the title");
            env.go({ mode: "title" });
          },
        },
        facilitator: facilitator.on
          ? {
              session: run ? sessionOptions(run) : undefined,
              reset: resetForNewPlayer,
              toTitle: () => env.go({ mode: "title" }),
            }
          : undefined,
      })
    : null;
  // Arc 1's coach line: its state lives for this part only (a new part mounts a new screen).
  let coach: CoachState = START_COACH;
  const coachStrip = tutorial
    ? createCoachStrip(panels.coach, (id) => {
        coach = dismissCoach(coach, id);
        refresh();
      })
    : null;
  const coachPointer = window.matchMedia("(pointer: coarse)");
  const coachInput = (part: TutorialPart): CoachInput => ({
    part,
    battle: controller.state(),
    ui: {
      orders: controller.orders(),
      selected: controller.selected(),
      charge: controller.charges().find((c) => c.selected)?.charge ?? null,
      support: controller.supportOrder(),
    },
    mode: coachMode(controller.mode() === "playback", controller.over()),
    events: controller.lastEvents(),
    pointer: coachPointer.matches ? "tap" : "click",
  });
  const status = createStatusStrip(panels.status);
  let statusIn: BattleStatusInput | null = null;
  let shownTissue = -1;
  const showStatus = (input: BattleStatusInput) => {
    statusIn = input;
    shownTissue = input.tissue;
    status.update(battleStatusModel(input));
  };
  const hud = createHud(
    panels,
    {
      onHelp: () => help.open(),
      onEndTurn: () => endTurn(),
      onSkip: () => {
        if (controller.mode() === "playback") {
          if (turnLog) turnLog.skipped = true;
          run?.ui("skip", `turn ${turnLog?.turn ?? "?"}`);
        }
        controller.skip();
      },
      onReplay: () => {
        if (controller.canReplay()) {
          if (turnLog) turnLog.replays++;
          run?.ui("replay", `turn ${turnLog?.turn ?? "?"}`);
        }
        controller.replay();
      },
      onSpeed: (speed) => controller.setSpeed(speed),
      // The debug battle keeps Reset in its bar; arc play has Start this fight over in the menu.
      onReset: menu ? undefined : () => controller.reset(),
      onSelect: (id) => controller.select(id),
      onClearOrder: (id) => controller.clearOrder(id),
      onWallOff: () => controller.wallOff(),
      onPickCharge: (charge) => controller.pickCharge(charge as ChargeKind),
      onClearSupport: () => controller.clearSupport(),
    },
    { tutorial },
  );
  const strip = createBroughtStrip(ui, () => {
    strip.hide();
    run?.ui("dismiss", "brought strip");
  });
  const probe = createProbe(ui);
  const probed = new Set<number>();
  let planStart = run?.elapsed() ?? 0;
  interface TurnLog {
    turn: number;
    orders: ReturnType<typeof controller.orders>;
    support: ReturnType<typeof controller.supportOrder>;
    planningMs: number;
    startedAt: number;
    doneAt: number | null;
    skipped: boolean;
    replays: number;
    speed: number;
  }
  let turnLog: TurnLog | null = null;
  const flushTurn = () => {
    if (!run || !turnLog) return;
    const t = turnLog;
    turnLog = null;
    run.turn({
      turn: t.turn,
      orders: t.orders,
      support: t.support,
      planningMs: t.planningMs,
      playbackMs: (t.doneAt ?? run.elapsed()) - t.startedAt,
      skipped: t.skipped || controller.reducedMotion(),
      replays: t.replays,
      speed: t.speed,
    });
  };
  const resolveTurn = () => {
    const turn = controller.state().turn;
    const orders = controller.orders();
    const support = controller.supportOrder();
    const now = run?.elapsed() ?? 0;
    flushTurn();
    controller.endTurn();
    if (run && controller.state().turn !== turn) {
      turnLog = {
        turn,
        orders,
        support,
        planningMs: now - planStart,
        startedAt: now,
        doneAt: null,
        skipped: false,
        replays: 0,
        speed: controller.speed(),
      };
      strip.hide();
    }
  };
  /**
   * Start this fight over: the controller reloads the battle as the Campaign holds it (its start;
   * the Campaign only takes a fight's result when it ends, so the week and its score are
   * untouched). The turns already played stay in the session log, closed off by a "reset" note.
   */
  function restartFight() {
    if (controller.over() || (run && run.campaign().mode !== "battle")) return;
    flushTurn();
    run?.ui(
      "reset",
      `fight restarted from turn 1 (was turn ${controller.state().turn})`,
    );
    probed.clear();
    planStart = run?.elapsed() ?? 0;
    strip.hide();
    controller.reset();
  }
  function endTurn() {
    if (!controller.canEndTurn() || probe.isOpen()) return;
    flushTurn();
    const turn = controller.state().turn;
    if (run && probeDue(turn, settings.probe) && !probed.has(turn)) {
      probe.ask(turn, (answer) => {
        probed.add(turn);
        run.probe(turn, answer ?? "(skipped)");
        resolveTurn();
      });
      return;
    }
    resolveTurn();
  }
  const outcomeOverlay = createOutcomeOverlay(ui, {
    onNext: () => {
      if (!run) {
        arcEnd?.onDone();
        return;
      }
      run.next();
      env.go(
        run.campaign().mode === "done"
          ? { mode: "summary", run }
          : { mode: "life", run },
      );
    },
    onPlayAgain: () => controller.reset(),
    onNewSeed: () => {
      validSeed = Math.floor(Math.random() * 1_000_000);
      const url = new URL(window.location.href);
      url.searchParams.set("seed", String(validSeed));
      window.history.replaceState(null, "", url);
      debug?.setSeed(validSeed);
      controller.reset();
    },
    onReplay: () => controller.replay(),
  });
  // Part A's story card, over the final board; it takes the place of the outcome card.
  const storyMenu = arcEnd?.part === "a" ? createMenu(ui) : null;
  let outcomeShown = false;
  // Part B's table compares against part A's readings; part A's are read off its own fight.
  const readingsA = () => partAReadings(load(), controller.state());
  const readout = document.createElement("div");
  readout.style.cssText =
    "font:11px monospace;color:var(--zw-text-muted);opacity:0.7;";
  let hovered: Coord | null = null;
  let selected: Coord | null = null;
  const fmt = (c: Coord | null) => (c ? `${c.x},${c.y}` : "-");
  const updateReadout = () => {
    readout.textContent = `hover ${fmt(hovered)}  selected ${fmt(selected)}`;
  };
  updateReadout();
  // The playback the scene is animating, and the last one seen (to spot a new or finished one).
  let playing: Playback | null = null;
  let seen: Playback | null = null;
  let shown: typeof state | null = null;
  const wallLines = (
    w: NonNullable<ReturnType<typeof controller.wallCard>>,
  ) => {
    const n = w.contents.length;
    const what = w.contents.map((c) => organismName(c.kind)).join(", ");
    return [
      n > 0
        ? `Seals what ${w.swarmId} carries (${what}) into a granuloma on this tile.`
        : `${w.swarmId} carries nothing to seal.`,
      `The tile is blocked for good and heats up to at least ${w.inflammation}` +
        (w.tissuePerTurn > 0 ? ` (-${w.tissuePerTurn} tissue a turn).` : "."),
      `${w.swarmId} is busy for ${w.busyTurns} more turn after this one.`,
    ];
  };
  function refresh() {
    const pb = controller.playback();
    let snap = false;
    let began = false;
    if (playing && (playing.done || playing !== pb)) {
      snap = playing.skipped || playing !== pb;
      playing = null;
      if (run) {
        planStart = run.elapsed();
        if (turnLog) turnLog.doneAt = planStart;
      }
      playbackView.end();
      shown = null;
    }
    if (pb !== seen) {
      seen = pb;
      if (pb && !pb.done) {
        began = true;
        playing = pb;
        playbackView.begin(pb);
        shown = pb.before;
      } else if (pb) {
        // Reduced motion: the turn was skipped at once.
        snap = true;
        playbackView.summary(pb);
        hud.pulse();
      }
    }
    const s = controller.displayState();
    // During playback the playback view owns the board, tokens and swarms.
    if (!playing && s !== shown) {
      view.update(s);
      pathogenView.update(s);
      granulomaView.update(s);
      swarmView.update(s, snap);
      shown = s;
    }
    // The pre-turn telegraph stays up (dimmed) while the turn plays out over it.
    if (!playing || began) telegraphView.update(s, controller.marks());
    telegraphView.setDim(playing !== null);
    pathogenView.setGrowing(
      playing
        ? []
        : controller
            .marks()
            .filter(
              (m) =>
                !m.cancelledBy &&
                !m.cancelledByCharge &&
                m.type !== "stall" &&
                (m.type === "grow" || !m.to),
            )
            .map((m) => m.pathogenId),
    );
    const statuses = controller.statuses();
    const idle =
      playing || controller.over()
        ? []
        : statuses.filter((w) => w.status === "none").map((w) => w.swarmId);
    orderView.update(
      s,
      controller.orders(),
      controller.targets(),
      idle,
      controller.dose(),
    );
    auraView.setAura(s.meds.aura);
    const sel = s.swarms.find((w) => w.id === controller.selected());
    view.setSelected(sel?.at ?? null);
    view.setOptions(controller.options());
    const forecast = controller.forecast();
    view.setForecast(forecast?.rising ?? []);
    selected = sel?.at ?? null;
    updateReadout();
    const wall = controller.wallCard();
    const supportOrder = playing ? null : controller.supportOrder();
    const supportCard = controller.supportCard();
    const outcome = controller.outcome();
    if (outcome && !playing) {
      if (!outcomeShown) {
        outcomeShown = true;
        let extra;
        if (run) {
          flushTurn();
          if (run.campaign().mode === "battle")
            run.finishBattle(controller.state());
          const c = run.campaign();
          const carry = carryPreview(c);
          extra = {
            nextLabel:
              c.cycle >= c.cycles ? "Finish" : `Start week ${c.life.week + 1}`,
            kept: carry.kept.length,
            dropped: carry.dropped.length,
            energyNext: carry.energy.next,
            lastWeek: c.cycle >= c.cycles,
            ...weekCardLines(c, carry.kept.length),
          };
        }
        if (storyMenu && arcEnd) {
          const readings = readingsA();
          arcEnd.onReadings?.(readings);
          const card = partAStoryCard(partAResult(load(), controller.state()), {
            outcome: readingsBlock(readings),
          });
          storyMenu.show({
            title: card.title,
            paragraphs: card.paragraphs,
            overBoard: { look: "Look at the board", show: "Show the story" },
            buttons: [
              { label: card.button, primary: true, onClick: arcEnd.onDone },
            ],
          });
        } else {
          const final = controller.state();
          const status = battleStatus(final);
          const rows = compareRows(arcEnd?.before, final, outcome.grade);
          outcomeOverlay.show(
            outcome,
            status,
            extra,
            final.kind,
            arcEnd?.label,
            tutorial
              ? {
                  summary: partBSummary(
                    arcById(arcEnd.arc),
                    outcome.grade,
                    status.reason === "backup",
                  ),
                  rows,
                  note: SKIPPED_LINE,
                }
              : undefined,
          );
        }
      }
    } else if (outcomeShown) {
      outcomeShown = false;
      outcomeOverlay.hide();
      storyMenu?.hide();
    }
    // Not mid-playback: the state is already the next turn's, and the strip is hidden anyway.
    let mark: CoachMark | null = null;
    if (coachStrip && arcEnd?.part && !playing) {
      const input = coachInput(arcEnd.part);
      coach = advanceCoach(coach, input);
      mark = coachMark(coach, input);
    }
    coachStrip?.update(mark);
    showStatus({
      tissue: s.tissueHealth,
      damage: forecast?.tissueDamage ?? 0,
      medLevel: s.meds.level,
      charges: s.meds.charges,
      choices: run ? weekChoices(run.campaign().life).total : null,
      noMedication: arcEnd?.part === "a",
    });
    hud.update({
      over: controller.over(),
      turn: s.turn,
      maxTurns: s.maxTurns,
      next: nextArrival(s),
      kind: s.kind,
      canEndTurn: controller.canEndTurn(),
      log: logLines(controller.lastEvents()),
      orders: statuses.map((w) => {
        const o = controller.orders().find((q) => q.swarmId === w.swarmId);
        return {
          swarmId: w.swarmId,
          label: w.label,
          detail: o ? describeOrder(o).slice(w.swarmId.length + 1) : "",
          hasOrder: o !== undefined,
          idle: w.status === "none",
          selected: w.selected,
        };
      }),
      holding: orderCount(statuses).holding,
      hint: playing ? "" : endTurnHint(orderCount(statuses).holding),
      info: controller.info(),
      medication: {
        level: s.meds.level,
        stallChance: stallChance(s.meds.aura),
      },
      charges: playing ? [] : controller.charges(),
      noTargets: controller.noTargets(),
      support: supportOrder && {
        charge: supportOrder.charge,
        detail: describeSupport(supportOrder).replace(/^\w+ /, ""),
        problem: supportCard?.valid === false ? supportCard.text : null,
      },
      supportCard,
      key: {
        aura: s.meds.aura > 0,
        charges: controller.charges().length > 0,
        kinds: PATHOGEN_ORDER.filter((k) =>
          s.pathogens.some((p) => !p.hidden && p.kind === k),
        ),
        heatLevels: heatKey(s, forecast?.rising.length ?? 0).levels,
        forecast: (forecast?.rising.length ?? 0) > 0,
        incoming: incomingKey(s).incoming,
        incomingBlocked: incomingKey(s).blocked,
      },
      odds: controller.odds(),
      problems: controller.problems(),
      wall: tutorial
        ? null
        : wall && {
            swarmId: wall.swarmId,
            queued: wall.queued,
            reason: wall.reason,
            lines: wallLines(wall),
          },
      forecast: forecast && {
        tissueDamage: forecast.tissueDamage,
        rising: forecast.rising.length,
        slowed: forecast.slowed,
      },
      coachTarget: mark?.target ?? null,
      playback: {
        playing: playing !== null,
        speed: controller.speed(),
        canReplay: controller.canReplay(),
        turn: playing?.before.turn ?? s.turn,
      },
    });
  }
  refresh();
  const debug = !facilitator.debugPanel
    ? null
    : createDebugPanel(panels.scroll, {
        scenario: state.scenario,
        seed: validSeed ?? defaultSeedFor(scenarioName),
        loadout: loadoutOptions,
        onRestart: (o) => {
          loadoutOptions = o;
          const url = new URL(window.location.href);
          writeLoadoutParams(url, o);
          window.history.replaceState(null, "", url);
          controller.reset();
        },
        skipPlayback: controller.reducedMotion(),
        onSkipPlayback: (on) => controller.setReducedMotion(on),
        mode: run ? "campaign" : "battle",
        onMode: (m) =>
          env.go(m === "campaign" ? { mode: "campaign" } : { mode: m }),
        session: run ? sessionOptions(run) : undefined,
      });
  panels.scroll.append(readout);
  if (!tutorial) help.showFirstTime();
  if (run && settings.brought) {
    const c = run.campaign();
    const skirmish = c.battleKind === "skirmish";
    const why = reasonText(c.result || skirmish ? [] : dueReasons(run));
    strip.show(
      skirmish
        ? SKIRMISH_HEADING.toLowerCase()
        : why
          ? why
          : "What you brought into this fight",
      broughtItems(c),
      skirmish,
    );
  }

  // Pointer events (not mouse) so touch works; the canvas must not pan or zoom on touch.
  canvas.style.touchAction = "none";
  const pickAt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return view.pick(
      {
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: -(((e.clientY - r.top) / r.height) * 2 - 1),
      },
      camera,
    );
  };
  canvas.addEventListener(
    "pointermove",
    (e) => {
      hovered = pickAt(e);
      view.setHover(hovered);
      updateReadout();
      controller.hover(hovered);
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      hovered = pickAt(e);
      view.setHover(hovered);
      controller.hover(hovered);
      controller.tap(hovered);
    },
    { signal },
  );
  window.addEventListener(
    "keydown",
    (e) => {
      if (help.isOpen() || probe.isOpen()) return;
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
      // A focused, enabled button already turns Enter and Space into a click.
      const onButton =
        t?.tagName === "BUTTON" && !(t as HTMLButtonElement).disabled;
      if ((e.key === "Enter" || e.key === " ") && !e.repeat && !onButton) {
        e.preventDefault();
        if (controller.mode() === "playback") controller.skip();
        else if (e.key === "Enter") endTurn();
      } else if (e.key === "Tab") {
        e.preventDefault();
        controller.cycle(e.shiftKey ? -1 : 1);
      } else if (e.key === "w" || e.key === "W") {
        controller.wallOff();
      } else if (e.key === "Escape") {
        // Clear a selected swarm or charge first; with nothing to clear, open the menu. A finished
        // fight's card handles its own Escape, so the menu waits for its button then.
        const act = escapeAction({
          menuOpen: false,
          otherOpen: outcomeShown || e.defaultPrevented || menu === null,
          pick:
            controller.selected() !== null ||
            controller.charges().some((c) => c.selected),
        });
        if (act === "openMenu") menu?.open();
        else controller.select(null);
      }
    },
    { signal },
  );
  canvas.addEventListener(
    "pointerleave",
    () => {
      hovered = null;
      view.setHover(null);
      updateReadout();
      controller.hover(null);
    },
    { signal },
  );

  return {
    setStats: (text) => debug?.setStats(text),
    tick(dt) {
      controller.tick(dt);
      if (playing) {
        playbackView.frame(playing.time);
        const tissue = playbackView.tissue();
        const live = tissue ?? playing.before.tissueHealth;
        if (statusIn && live !== shownTissue) {
          showStatus({ ...statusIn, tissue: live, damage: 0 });
        }
        hud.setLive(
          playing.timeline.duration > 0
            ? playing.time / playing.timeline.duration
            : 1,
        );
      }
      playbackView.tick(dt);
      pathogenView.tick(dt);
      swarmView.tick(dt);
      orderView.tick(dt);
      auraView.tick(dt);
      view.tick(dt);
    },
    back: menu
      ? () => {
          const act = backAction({
            menuOpen: menu.isOpen(),
            helpOpen: help.isOpen(),
            blocked: probe.isOpen(),
          });
          if (act === "openMenu") menu.open();
          else if (act === "closeMenu") menu.close();
          else if (act === "closeHelp") help.close();
        }
      : undefined,
    dispose() {
      ac.abort();
      flushTurn();
      strip.dispose();
      probe.dispose();
      help.dispose();
      menu?.dispose();
      storyMenu?.dispose();
      status.clear();
      coachStrip?.clear();
      panels.scroll.replaceChildren();
      panels.bar.replaceChildren();
      ui.replaceChildren();
    },
  };
}

function dueReasons(run: Run) {
  const life = run.campaign().life;
  return battleDueReasons(life);
}

/** The luck line, the "still hard" line and the "This week" block for a finished campaign week. */
function weekCardLines(
  c: Campaign,
  kept: number,
): Pick<OutcomeExtra, "luck" | "stillHard" | "week"> {
  const { result, life } = c;
  if (!result) return {};
  const odds = weekOdds(life);
  const reasons = result.kind === "battle" ? result.reasons : [];
  const landed = reasons.includes("exposure");
  return {
    luck: luckLine(odds, landed, {
      flared: reasons.includes("reservoir"),
      doctorFound: reasons.includes("doctor"),
    }),
    stillHard:
      result.kind === "battle"
        ? (stillHardLine(
            result.outcome.grade,
            result.battleKind,
            odds,
            medDoses(life.medLevel),
          ) ?? undefined)
        : undefined,
    week: thisWeekRows(
      life,
      result,
      odds,
      landed,
      weekScore(life, result, kept),
    ),
  };
}
