import { createScene } from "../render/scene";
import { getUiRoot } from "../ui";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
getUiRoot();
const { render } = createScene(canvas);

function frame() {
  render();
  requestAnimationFrame(frame);
}
frame();
