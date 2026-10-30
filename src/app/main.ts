import { createBoardView } from "../render/boardView";
import { createFxView } from "../render/fxView";
import { createGranulomaView } from "../render/granulomaView";
import { createOrderView } from "../render/orderView";
import { createPathogenView } from "../render/pathogenView";
import type { Playback } from "../render/playback";
import { createPlaybackView } from "../render/playbackView";
import { createScene } from "../render/scene";
import { createSwarmView } from "../render/swarmView";
import { createTelegraphView } from "../render/telegraphView";
import {
  DEFAULT_SCENARIO,
  isScenarioName,
  loadScenario,
} from "../sim/scenarios";
import { battleStatus } from "../sim/battle/outcome";
import { PARAMS } from "../sim/params";
import { pathogenKind } from "../sim/pathogens";
import type { Coord } from "../sim/types";
import { getPanels, getUiRoot } from "../ui";
import { createDebugPanel } from "../ui/debugPanel";
import { createHelp } from "../ui/help";
import { createHud } from "../ui/hud";
import { createOutcomeOverlay } from "../ui/outcome";
import { createController, describeOrder, logLines } from "./controller";
import { endTurnHint, heatKey, orderCount } from "./info";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const ui = getUiRoot();
const panels = getPanels();

const params = new URLSearchParams(window.location.search);
const requested = params.get("scenario") ?? DEFAULT_SCENARIO;
if (!isScenarioName(requested)) {
  console.warn(`Unknown scenario "${requested}", using "${DEFAULT_SCENARIO}"`);
}
const seedParam = params.get("seed");
const seed = seedParam === null ? undefined : Number(seedParam);
if (seed !== undefined && !Number.isFinite(seed)) {
  console.warn(`Invalid seed "${seedParam}", using the default`);
}
const scenarioName = isScenarioName(requested) ? requested : DEFAULT_SCENARIO;
let validSeed = seed !== undefined && Number.isFinite(seed) ? seed : undefined;
const load = () => {
  const s = loadScenario(scenarioName, validSeed);
  if (!s) throw new Error("default scenario failed to load");
  return s;
};

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const controller = createController(load, () => refresh(), {
  reducedMotion: motionQuery.matches,
});
motionQuery.addEventListener("change", (e) =>
  controller.setReducedMotion(e.matches),
);
const state = controller.state();

const { board } = state;
const { render, camera, scene } = createScene(canvas, {
  width: board.width,
  depth: board.height,
});
const view = createBoardView(scene, state);
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
});
const outcomeOverlay = createOutcomeOverlay(ui, {
  onPlayAgain: () => controller.reset(),
  onNewSeed: () => {
    validSeed = Math.floor(Math.random() * 1_000_000);
    const url = new URL(window.location.href);
    url.searchParams.set("seed", String(validSeed));
    window.history.replaceState(null, "", url);
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
const wallLines = (w: NonNullable<ReturnType<typeof controller.wallCard>>) => {
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
  const statuses = controller.statuses();
  const idle =
    playing || controller.over()
      ? []
      : statuses.filter((w) => w.status === "none").map((w) => w.swarmId);
  orderView.update(s, controller.orders(), controller.targets(), idle);
  const sel = s.swarms.find((w) => w.id === controller.selected());
  view.setSelected(sel?.at ?? null);
  view.setOptions(controller.options());
  const forecast = controller.forecast();
  view.setForecast(forecast?.rising ?? []);
  selected = sel?.at ?? null;
  updateReadout();
  const wall = controller.wallCard();
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
    key: {
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
  skipPlayback: controller.reducedMotion(),
  onSkipPlayback: (on) => controller.setReducedMotion(on),
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
canvas.addEventListener("pointermove", (e) => {
  hovered = pickAt(e);
  view.setHover(hovered);
  updateReadout();
  controller.hover(hovered);
});
canvas.addEventListener("pointerdown", (e) => {
  hovered = pickAt(e);
  view.setHover(hovered);
  controller.hover(hovered);
  controller.tap(hovered);
});
window.addEventListener("keydown", (e) => {
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
});
canvas.addEventListener("pointerleave", () => {
  hovered = null;
  view.setHover(null);
  updateReadout();
  controller.hover(null);
});

let last = performance.now();
let statFrames = 0;
let statTime = 0;
let statMax = 0;
function frame(now: number = performance.now()) {
  const raw = now - last;
  const dt = Math.min(raw / 1000, 0.1);
  last = now;
  statFrames++;
  statTime += raw;
  statMax = Math.max(statMax, raw);
  if (statTime >= 500) {
    const ms = statTime / statFrames;
    debug.setStats(
      `${Math.round(1000 / ms)} fps  ${ms.toFixed(1)} ms (max ${statMax.toFixed(1)})`,
    );
    statFrames = 0;
    statTime = 0;
    statMax = 0;
  }
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
  render();
  requestAnimationFrame(frame);
}
frame();
