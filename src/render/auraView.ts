import * as THREE from "three";

export interface AuraView {
  readonly group: THREE.Group;
  /** Glow strength from the medication aura, 0..1. 0 hides it. */
  setAura(aura: number): void;
  /** Slow breathing of the glow. */
  tick(dtSeconds: number): void;
}

const MAX_OPACITY = 0.32;

/** A soft mint glow hugging the board edge, drawn flat over the outer tiles and fading inward. */
function edgeTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const inset = 0.2 * size;
    const glow = (x0: number, y0: number, x1: number, y1: number) => {
      const grad = g.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, "rgba(120,240,205,0.9)");
      grad.addColorStop(1, "rgba(120,240,205,0)");
      return grad;
    };
    g.fillStyle = glow(0, 0, 0, inset);
    g.fillRect(0, 0, size, inset);
    g.fillStyle = glow(0, size, 0, size - inset);
    g.fillRect(0, size - inset, size, inset);
    g.fillStyle = glow(0, 0, inset, 0);
    g.fillRect(0, 0, inset, size);
    g.fillStyle = glow(size, 0, size - inset, 0);
    g.fillRect(size - inset, 0, inset, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAuraView(
  scene: THREE.Scene,
  extent: { width: number; depth: number },
): AuraView {
  const group = new THREE.Group();
  scene.add(group);
  const mat = new THREE.MeshBasicMaterial({
    map: edgeTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  const geo = new THREE.PlaneGeometry(extent.width + 0.3, extent.depth + 0.3);
  geo.rotateX(-Math.PI / 2);
  const plane = new THREE.Mesh(geo, mat);
  plane.position.y = 0.012;
  plane.renderOrder = -1;
  plane.visible = false;
  group.add(plane);
  let level = 0;
  let clock = 0;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
  const apply = () => {
    const breathe = calm.matches ? 1 : 0.9 + 0.1 * Math.sin(clock * 1.4);
    mat.opacity = MAX_OPACITY * level * breathe;
    plane.visible = level > 0.01;
  };
  return {
    group,
    setAura(aura) {
      level = Math.min(1, Math.max(0, aura));
      apply();
    },
    tick(dt) {
      clock += dt;
      apply();
    },
  };
}
