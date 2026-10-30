import { createBoardView } from "../render/boardView";
import { createFxView } from "../render/fxView";
import { createGranulomaView } from "../render/granulomaView";
import { createOrderView } from "../render/orderView";
import { createPathogenView } from "../render/pathogenView";
import type { Playback } from "../render/playback";
import { createPlaybackView } from "../render/playbackView";
import { createSwarmView } from "../render/swarmView";
import { createTelegraphView } from "../render/telegraphView";
import { createAuraView } from "../render/auraView";
import { battleFromLoadout } from "../sim/battle/setup";
import { DEFAULT_SCENARIO, isScenarioName } from "../sim/scenarios";
import { stallChance } from "../sim/battle/intents";
import { battleStatus } from "../sim/battle/outcome";
import { PARAMS } from "../sim/params";
import { pathogenKind } from "../sim/pathogens";
import type { BattleState, ChargeKind, Coord } from "../sim/types";
import type { Screen, ScreenEnv } from "./screen";
import { createDebugPanel } from "../ui/debugPanel";
import { createHelp } from "../ui/help";
import { createHud } from "../ui/hud";
import { createOutcomeOverlay } from "../ui/outcome";
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
export function mountBattle(env: ScreenEnv, start?: BattleState): Screen {
  const { canvas, camera, root: scene, ui, panels } = env;
  const ac = new AbortController();
  const { signal } = ac;

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
      loadoutFor(scenarioName, validSeed ?? PARAMS.defaultSeed, loadoutOptions),
    );

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const controller = createController(load, () => refresh(), {
    reducedMotion: motionQuery.matches,
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
  const hud = createHud(panels, {
    onHelp: () => help.open(),
    onEndTurn: () => controller.endTurn(),
    onSkip: () => controller.skip(),
    onReplay: () => controller.replay(),
    onSpeed: (speed) => controller.setSpeed(speed),
    onReset: () => controller.reset(),
    onSelect: (id) => controller.select(id),
    onClearOrder: (id) => controller.clearOrder(id),
    onWallOff: () => controller.wallOff(),
    onPickCharge: (charge) => controller.pickCharge(charge as ChargeKind),
    onClearSupport: () => controller.clearSupport(),
  });
  const outcomeOverlay = createOutcomeOverlay(ui, {
    onPlayAgain: () => controller.reset(),
    onNewSeed: () => {
      validSeed = Math.floor(Math.random() * 1_000_000);
      const url = new URL(window.location.href);
      url.searchParams.set("seed", String(validSeed));
      window.history.replaceState(null, "", url);
      debug.setSeed(validSeed);
      controller.reset();
    },
    onReplay: () => controller.replay(),
  });
  let outcomeShown = false;
  const readout = document.createElement("div");
  readout.style.cssText = "font:11px monospace;color:#c8ccd4;opacity:0.7;";
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
    const what = w.contents.map((c) => pathogenKind(c.kind).label).join(", ");
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
        outcomeOverlay.show(outcome, battleStatus(controller.state()));
      }
    } else if (outcomeShown) {
      outcomeShown = false;
      outcomeOverlay.hide();
    }
    hud.update({
      over: controller.over(),
      turn: s.turn,
      maxTurns: s.maxTurns,
      tissueHealth: s.tissueHealth,
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
        heatLevels: heatKey(s, forecast?.rising.length ?? 0).levels,
        forecast: (forecast?.rising.length ?? 0) > 0,
      },
      odds: controller.odds(),
      problems: controller.problems(),
      wall: wall && {
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
      playback: {
        playing: playing !== null,
        speed: controller.speed(),
        canReplay: controller.canReplay(),
        turn: playing?.before.turn ?? s.turn,
      },
    });
  }
  refresh();
  const debug = createDebugPanel(panels.scroll, {
    scenario: state.scenario,
    seed: validSeed ?? PARAMS.defaultSeed,
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
    mode: "battle",
    onMode: (m) => env.go({ mode: m }),
  });
  panels.scroll.append(readout);
  help.showFirstTime();

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
      if (help.isOpen()) return;
      const t = e.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
      // A focused, enabled button already turns Enter and Space into a click.
      const onButton =
        t?.tagName === "BUTTON" && !(t as HTMLButtonElement).disabled;
      if ((e.key === "Enter" || e.key === " ") && !e.repeat && !onButton) {
        e.preventDefault();
        if (controller.mode() === "playback") controller.skip();
        else if (e.key === "Enter") controller.endTurn();
      } else if (e.key === "Tab") {
        e.preventDefault();
        controller.cycle(e.shiftKey ? -1 : 1);
      } else if (e.key === "w" || e.key === "W") {
        controller.wallOff();
      } else if (e.key === "Escape") {
        controller.select(null);
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
    setStats: (text) => debug.setStats(text),
    tick(dt) {
      controller.tick(dt);
      if (playing) {
        playbackView.frame(playing.time);
        const tissue = playbackView.tissue();
        hud.setLive(
          tissue ?? playing.before.tissueHealth,
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
    },
    dispose() {
      ac.abort();
      help.dispose();
      panels.scroll.replaceChildren();
      panels.bar.replaceChildren();
      ui.replaceChildren();
    },
  };
}
