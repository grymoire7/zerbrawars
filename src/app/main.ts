import * as THREE from "three";
import { createScene } from "../render/scene";
import { battleFromLoadout } from "../sim/battle/setup";
import { PARAMS } from "../sim/params";
import {
  DEFAULT_SCENARIO,
  defaultSeedFor,
  type ScenarioName,
} from "../sim/scenarios";
import { getPanels, getUiRoot } from "../ui";
import { mountBattle } from "./battleScreen";
import { mountInterlude } from "./interludeScreen";
import { mountLife } from "./lifeScreen";
import { parseGoal, parseReservoirs } from "./campaignModel";
import { createRun, type Run } from "./run";
import { afterPart, type PartAReadings } from "./tutorialModel";
import { arcById, type ArcId, type VariantId } from "./arcs";
import { initFacilitator } from "./facilitator";
import { mountMenu } from "./menuScreens";
import { parseStart, resumeTarget } from "./arcModel";
import { clearHeld, heldRun, holdRun } from "./heldRun";
import {
  DEFAULT_OPTIONS,
  loadoutFor,
  parseLoadoutParams,
} from "./loadoutOptions";
import { parseMode, type Screen, type ScreenRequest } from "./screen";
import {
  GUARD_STATE,
  historyStep,
  isGuardState,
  shouldWarnOnLeave,
} from "./navGuardModel";
import { applyCssTokens } from "../theme/palette";

applyCssTokens(document.documentElement);

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const ui = getUiRoot();
const panels = getPanels();
const params = new URLSearchParams(window.location.search);
// Facilitator mode and the developer-start check are read once here and kept for the page session.
initFacilitator(params);

// Both screens share the battle board's footprint, so one camera framing serves them.
const extent = battleFromLoadout(
  loadoutFor(DEFAULT_SCENARIO, PARAMS.defaultSeed, parseLoadoutParams(params)),
).board;
const ctx = createScene(canvas, { width: extent.width, depth: extent.height });

let screen: Screen | null = null;
let root: THREE.Scene | null = null;

const urlVariant = (q: URLSearchParams): VariantId =>
  q.get("variant") === "ar" ? "ar" : "xl";

function newRun(
  standalone: boolean,
  seed?: number,
  variant?: VariantId,
  arc?: ArcId,
): Run {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get("seed");
  const fromUrl =
    raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : null;
  const med = q.has("med") ? Number(q.get("med")) : NaN;
  return createRun({
    seed: seed ?? fromUrl ?? PARAMS.defaultSeed,
    reservoirs: parseReservoirs(q.get("reservoirs")),
    med: Number.isFinite(med) ? Math.min(1, Math.max(0, med)) : undefined,
    goalTarget: parseGoal(q.get("goal")),
    variant: variant ?? urlVariant(q),
    arc,
    standalone,
  });
}

// Back during play. Play screens (those with a game menu) sit on one extra history entry, the
// guard. Back pops it; we answer by opening or closing the menu and pushing it again, so the stack
// never grows and Back never leaves play. Leaving for a menu screen pops it (one history.back,
// whose popstate is swallowed), so Back on the title is the browser's own.
let cleanUrl: URL = new URL(window.location.href);
let armed = false;
let swallow = 0;
let arcFightInPlay = false;
/** Arc 1: what part A ended on, kept in memory for part B's table. Nothing is stored. */
let partA: PartAReadings | undefined;

/** Rewrites the address without touching the history entry's state (the guard marker). */
function setUrl(url: URL) {
  cleanUrl = url;
  window.history.replaceState(window.history.state, "", url);
}

function pushGuard() {
  window.history.pushState(GUARD_STATE, "", window.location.href);
}

function syncGuard(want: boolean) {
  armed = want;
  const step = historyStep({
    wantGuard: want,
    onGuardEntry: isGuardState(window.history.state),
  });
  if (step === "push") pushGuard();
  else if (step === "pop") {
    swallow++;
    window.history.back();
  }
}

window.addEventListener("popstate", () => {
  if (swallow > 0) {
    swallow--;
    if (swallow > 0) return;
    // Back on the page's own entry: its address may be stale (a debug start), so tidy it.
    window.history.replaceState(window.history.state, "", cleanUrl);
    if (armed) pushGuard();
    return;
  }
  if (!armed) return;
  screen?.back?.();
  pushGuard();
});

// A reload or tab close would lose the held summer or the arc fight in play.
window.addEventListener("beforeunload", (e) => {
  if (shouldWarnOnLeave({ held: heldRun() !== null, arcFightInPlay })) {
    e.preventDefault();
    e.returnValue = "";
  }
});

/** Mounts the requested screen, then makes the history match it. */
function go(req: ScreenRequest) {
  mount(req);
  syncGuard(screen?.back !== undefined);
}

/** Tears down the current screen and mounts the requested one. The campaign loop drives this. */
function mount(req: ScreenRequest) {
  if (req.mode === "continue") {
    // A held summer picks up where the campaign was left: a week as it was, a fight from turn 1.
    const run = heldRun();
    if (!run) return mount({ mode: "title" });
    run.ui("continue", resumeTarget(run.campaign()));
    const to = resumeTarget(run.campaign());
    return mount(to === "battle" ? { mode: "battle", run } : { mode: to, run });
  }
  arcFightInPlay = false;
  screen?.dispose();
  if (root) ctx.scene.remove(root);
  root = new THREE.Scene();
  ctx.scene.add(root);
  const env = { canvas, camera: ctx.camera, root, panels, ui, go };
  const url = new URL(window.location.href);
  const setMode = (m: string | null) => {
    if (m) url.searchParams.set("mode", m);
    else url.searchParams.delete("mode");
  };
  if (
    req.mode === "title" ||
    req.mode === "arcs" ||
    req.mode === "arcComplete" ||
    req.mode === "arcIntro"
  ) {
    // Menus are not a debug start: reloading one lands on the title.
    for (const k of ["mode", "seed", "variant", "arc", "part"])
      url.searchParams.delete(k);
    setUrl(url);
    screen = mountMenu(env, req);
    return;
  }
  if (req.mode === "arcPlay") {
    setMode(null);
    setUrl(url);
    const arc = arcById(req.arc);
    if (arc.play.kind === "campaign") {
      // Arc play held for Continue; a new summer replaces the one held.
      const run = newRun(false, req.seed, req.variant, arc.id);
      holdRun(run);
      screen = mountLife(env, run);
      return;
    }
    // A single battle from a scenario, with the variant's residual kill chance (a scenario that
    // fixes its own, like tutorial-a, keeps it).
    const fight = (scenario: ScenarioName) =>
      battleFromLoadout(
        loadoutFor(scenario, defaultSeedFor(scenario), {
          ...DEFAULT_OPTIONS,
          residual: PARAMS.residualByVariant[req.variant],
        }),
      );
    const complete = () =>
      go({ mode: "arcComplete", arc: arc.id, variant: req.variant });
    if (arc.play.kind === "tutorial") {
      const part = req.part;
      // Only a part A played in this run feeds part B: the intro, or starting at B, forgets it.
      if (part !== "b") partA = undefined;
      if (!part)
        return mount({ mode: "arcIntro", arc: arc.id, variant: req.variant });
      arcFightInPlay = true;
      screen = mountBattle(
        env,
        fight(part === "a" ? arc.play.partA : arc.play.partB),
        undefined,
        {
          label: "Finish",
          arc: arc.id,
          variant: req.variant,
          part,
          before: part === "b" ? partA : undefined,
          onReadings: (readings) => {
            partA = readings;
          },
          onDone: () => {
            const next = afterPart(part);
            if (next === "complete") complete();
            else
              go({
                mode: "arcPlay",
                arc: arc.id,
                variant: req.variant,
                part: next,
              });
          },
        },
      );
      return;
    }
    arcFightInPlay = true;
    screen = mountBattle(env, fight(arc.play.scenario), undefined, {
      label: "Finish",
      arc: arc.id,
      variant: req.variant,
      onDone: complete,
    });
    return;
  }
  // Only arc play is held; the debug entries below start runs that Continue never offers.
  if (req.mode === "summary") clearHeld(req.run);
  if (
    req.mode === "campaign" ||
    ((req.mode === "life" || req.mode === "battle") && !req.run)
  )
    clearHeld();
  if (req.mode === "campaign") {
    if (req.seed !== undefined) url.searchParams.set("seed", String(req.seed));
    if (req.variant !== undefined) url.searchParams.set("variant", req.variant);
    setUrl(url);
    const run = newRun(false, req.seed, req.variant);
    setMode(null);
    setUrl(url);
    screen = mountLife(env, run);
    return;
  }
  if (req.mode === "life") {
    const run = req.run ?? newRun(true);
    setMode(run.standalone ? "life" : null);
    screen = mountLife(env, run);
  } else if (req.mode === "battle") {
    setMode(req.run ? null : "battle");
    screen = mountBattle(env, req.battle, req.run);
  } else {
    setMode(null);
    screen = mountInterlude(env, req.run, req.mode);
  }
  setUrl(url);
}
const start = parseStart(params);
if (start.kind === "title") go({ mode: "title" });
else if (start.kind === "arcs") go({ mode: "arcs", variant: start.variant });
else if (start.kind === "arc")
  go({
    mode: "arcPlay",
    arc: start.arc,
    variant: start.variant,
    part: start.part,
  });
else {
  const first = parseMode(params);
  go(first === "campaign" ? { mode: "campaign" } : { mode: first });
}

let last = performance.now();
let statFrames = 0;
let statTime = 0;
let statMax = 0;
function frame(now: number = performance.now()) {
  const raw = now - last;
  last = now;
  statFrames++;
  statTime += raw;
  statMax = Math.max(statMax, raw);
  if (statTime >= 500) {
    const ms = statTime / statFrames;
    screen?.setStats(
      `${Math.round(1000 / ms)} fps  ${ms.toFixed(1)} ms (max ${statMax.toFixed(1)})`,
    );
    statFrames = 0;
    statTime = 0;
    statMax = 0;
  }
  screen?.tick(Math.min(raw / 1000, 0.1));
  ctx.render();
  requestAnimationFrame(frame);
}
frame();
