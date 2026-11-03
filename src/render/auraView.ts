import * as THREE from "three";
import { basePlaneUnits, createAuraTexture } from "./tissueTexture";

export interface AuraView {
  readonly group: THREE.Group;
  /** Glow strength from the medication aura, 0..1. 0 hides it. */
  setAura(aura: number): void;
  /** Slow breathing of the glow. */
  tick(dtSeconds: number): void;
}

const MAX_OPACITY = 0.32;

export function createAuraView(
  scene: THREE.Scene,
  extent: { width: number; depth: number },
): AuraView {
  const group = new THREE.Group();
  scene.add(group);
  const units = basePlaneUnits({ width: extent.width, height: extent.depth });
  const mat = new THREE.MeshBasicMaterial({
    map: createAuraTexture(units),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  const geo = new THREE.PlaneGeometry(units, units);
  geo.rotateX(-Math.PI / 2);
  const plane = new THREE.Mesh(geo, mat);
  // Same height as the base (just above it) and the same centre, so there is no parallax gap.
  plane.position.y = -0.19;
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
