import * as THREE from "three";
import { createScene } from "../render/scene";
import { battleFromLoadout } from "../sim/battle/setup";
import { PARAMS } from "../sim/params";
import { DEFAULT_SCENARIO } from "../sim/scenarios";
import { getPanels, getUiRoot } from "../ui";
import { mountBattle } from "./battleScreen";
import { mountLife } from "./lifeScreen";
import { loadoutFor, parseLoadoutParams } from "./loadoutOptions";
import { parseMode, type Screen, type ScreenRequest } from "./screen";

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

/** Tears down the current screen and mounts the requested one. The campaign loop will call this. */
function go(req: ScreenRequest) {
  screen?.dispose();
  if (root) ctx.scene.remove(root);
  root = new THREE.Scene();
  ctx.scene.add(root);
  const url = new URL(window.location.href);
  if (req.mode === "life") url.searchParams.set("mode", "life");
  else url.searchParams.delete("mode");
  window.history.replaceState(null, "", url);
  const env = { canvas, camera: ctx.camera, root, panels, ui, go };
  screen = req.mode === "life" ? mountLife(env) : mountBattle(env, req.battle);
}
go({ mode: parseMode(params) });

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
