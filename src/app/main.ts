import { createBoardView } from "../render/boardView";
import { createPathogenView } from "../render/pathogenView";
import { createScene } from "../render/scene";
import { createSwarmView } from "../render/swarmView";
import {
  DEFAULT_SCENARIO,
  isScenarioName,
  loadScenario,
} from "../sim/scenarios";
import { PARAMS } from "../sim/params";
import type { Coord } from "../sim/types";
import { getUiRoot } from "../ui";
import { createDebugPanel } from "../ui/debugPanel";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const ui = getUiRoot();

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
const state = loadScenario(
  isScenarioName(requested) ? requested : DEFAULT_SCENARIO,
  seed !== undefined && Number.isFinite(seed) ? seed : undefined,
);
if (!state) throw new Error("default scenario failed to load");

const { board } = state;
const { render, camera, scene } = createScene(canvas, {
  width: board.width,
  depth: board.height,
});
const view = createBoardView(scene, state);
const pathogenView = createPathogenView(scene, view.tilePosition);
const swarmView = createSwarmView(scene, view.tilePosition);
pathogenView.update(state);
swarmView.update(state);
createDebugPanel(ui, {
  scenario: state.scenario,
  seed: seed !== undefined && Number.isFinite(seed) ? seed : PARAMS.defaultSeed,
});

const readout = document.createElement("div");
readout.style.cssText =
  "position:absolute;left:8px;top:8px;font:12px monospace;color:#c8ccd4;opacity:0.7";
ui.appendChild(readout);

let hovered: Coord | null = null;
let selected: Coord | null = null;
const fmt = (c: Coord | null) => (c ? `${c.x},${c.y}` : "-");
const updateReadout = () => {
  readout.textContent = `hover ${fmt(hovered)}  selected ${fmt(selected)}`;
};
updateReadout();

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
});
canvas.addEventListener("pointerdown", (e) => {
  hovered = pickAt(e);
  selected = hovered;
  view.setHover(hovered);
  view.setSelected(selected);
  updateReadout();
});
canvas.addEventListener("pointerleave", () => {
  hovered = null;
  view.setHover(null);
  updateReadout();
});

let last = performance.now();
function frame(now: number = performance.now()) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  pathogenView.tick(dt);
  swarmView.tick(dt);
  render();
  requestAnimationFrame(frame);
}
frame();
