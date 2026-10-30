import * as THREE from "three";

export interface SceneContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  render: () => void;
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1c22);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(6, 7, 8);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x333344, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(4, 8, 3);
  scene.add(sun);

  const box = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0x888888 }),
  );
  scene.add(box);

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    render: () => renderer.render(scene, camera),
  };
}
