import * as THREE from "three";
import { setLabelBoost } from "./labels";

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  render: () => void;
}

/** Fixed viewing direction (from the board centre toward the camera): near edge is at the bottom. */
const VIEW_DIR = new THREE.Vector3(0, 7, 6).normalize();
const FRAME_MARGIN = 0.94;

/**
 * `extent` is the board footprint in world units; the camera backs off until all of it fits in
 * the canvas's container (not the window).
 */
export function createScene(
  canvas: HTMLCanvasElement,
  extent: { width: number; depth: number },
): SceneContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1c22);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(-3, 9, 5);
  scene.add(sun);

  const hx = extent.width / 2 + 0.15;
  const hz = extent.depth / 2 + 0.15;
  const corners = [-1, 1].flatMap((sx) =>
    [-0.5, 0.1].flatMap((y) =>
      [-1, 1].map((sz) => new THREE.Vector3(sx * hx, y, sz * hz)),
    ),
  );

  const fits = (dist: number) => {
    camera.position.copy(VIEW_DIR).multiplyScalar(dist);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    return corners.every((c) => {
      const p = c.clone().project(camera);
      return Math.abs(p.x) <= FRAME_MARGIN && Math.abs(p.y) <= FRAME_MARGIN;
    });
  };

  const frame = () => {
    let lo = 1;
    let hi = 80;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    fits(hi);
  };

  const host = canvas.parentElement ?? document.body;
  const resize = () => {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    setLabelBoost(w, h);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frame();
  };
  new ResizeObserver(resize).observe(host);
  resize();

  return {
    renderer,
    scene,
    camera,
    render: () => renderer.render(scene, camera),
  };
}
