import * as THREE from "three";
import { createScene } from "../render/scene";
import { battleFromLoadout } from "../sim/battle/setup";
import { PARAMS } from "../sim/params";
import { DEFAULT_SCENARIO } from "../sim/scenarios";
import { getPanels, getUiRoot } from "../ui";
import { mountBattle } from "./battleScreen";
import { mountInterlude } from "./interludeScreen";
import { mountLife } from "./lifeScreen";
import { parseGoal, parseReservoirs } from "./campaignModel";
import { createRun, type Run } from "./run";
import { arcById, type ArcId, type VariantId } from "./arcs";
import { mountMenu } from "./menuScreens";
import { parseStart } from "./arcModel";
import {
  DEFAULT_OPTIONS,
  loadoutFor,
  parseLoadoutParams,
} from "./loadoutOptions";
import { parseMode, type Screen, type ScreenRequest } from "./screen";
import { applyCssTokens } from "../theme/palette";

applyCssTokens(document.documentElement);

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const ui = getUiRoot();
const panels = getPanels();
const params = new URLSearchParams(window.location.search);

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

/** Tears down the current screen and mounts the requested one. The campaign loop drives this. */
function go(req: ScreenRequest) {
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
    req.mode === "arcComplete"
  ) {
    // Menus are not a debug start: reloading one lands on the title.
    for (const k of ["mode", "seed", "variant", "arc"])
      url.searchParams.delete(k);
    window.history.replaceState(null, "", url);
    screen = mountMenu(env, req);
    return;
  }
  if (req.mode === "arcPlay") {
    setMode(null);
    window.history.replaceState(null, "", url);
    const arc = arcById(req.arc);
    if (arc.play.kind === "campaign") {
      screen = mountLife(env, newRun(false, undefined, req.variant, arc.id));
      return;
    }
    // A single battle from the scenario, with the variant's residual kill chance.
    const battle = battleFromLoadout(
      loadoutFor(arc.play.scenario, PARAMS.defaultSeed, {
        ...DEFAULT_OPTIONS,
        residual: PARAMS.residualByVariant[req.variant],
      }),
    );
    screen = mountBattle(env, battle, undefined, {
      label: "Finish",
      onDone: () =>
        go({ mode: "arcComplete", arc: arc.id, variant: req.variant }),
    });
    return;
  }
  if (req.mode === "campaign") {
    if (req.seed !== undefined) url.searchParams.set("seed", String(req.seed));
    if (req.variant !== undefined) url.searchParams.set("variant", req.variant);
    window.history.replaceState(null, "", url);
    const run = newRun(false, req.seed, req.variant);
    setMode(null);
    window.history.replaceState(null, "", url);
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
  window.history.replaceState(null, "", url);
}
const start = parseStart(params);
if (start.kind === "title") go({ mode: "title" });
else if (start.kind === "arcs") go({ mode: "arcs", variant: start.variant });
else if (start.kind === "arc")
  go({ mode: "arcPlay", arc: start.arc, variant: start.variant });
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
