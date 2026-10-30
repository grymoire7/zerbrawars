import * as THREE from "three";
import { labelMaterial, sizeLabel } from "./labels";
import { PATHOGEN_KINDS, type PathogenForm } from "../sim/pathogens";
import type { BattleState, Coord, Pathogen, PathogenId } from "../sim/types";

export interface PathogenView {
  readonly group: THREE.Group;
  /**
   * Rebuilds tokens from the pathogens given (state's by default). Reads only; never mutates it.
   * Playback passes extra not-yet-born pathogens so it can grow them in.
   */
  update(state: BattleState, pathogens?: readonly Pathogen[]): void;
  /** Playback pose: uniform scale, vertical squash and a world offset from the tile. */
  setPose(
    id: PathogenId,
    scale: number,
    squash: number,
    dx: number,
    dy: number,
    dz: number,
  ): void;
  /** Shows a different size (body scale and size badge) without rebuilding everything. */
  setSize(id: PathogenId, size: number): void;
  /** Resets every pose to rest. */
  clearPoses(): void;
  /** Pathogens that will grow next turn swell slowly (a static token under reduced motion). */
  setGrowing(ids: readonly PathogenId[]): void;
  /** Gentle idle bob so tokens read as alive. */
  tick(dtSeconds: number): void;
}

// Shape carries the growth form; the rim carries sealed vs leaky. Colors are secondary and chosen
// to differ in lightness as well as hue (orange vs violet), so red/green confusion does not matter.
export const FORM_COLOR: Record<PathogenForm, number> = {
  bacterium: 0xe8a33d,
  mold: 0x6f4fb8,
};
const RIM_COLOR = 0xf4efe0;
const BADGE_HEIGHT = 0.34;

// Fixed offsets (unit-ish sphere packing) so every bacterium cluster looks the same.
const CLUSTER: readonly (readonly [number, number, number, number])[] = [
  [0, 0.2, 0, 0.17],
  [0.17, 0.12, 0.05, 0.13],
  [-0.15, 0.13, 0.08, 0.13],
  [0.04, 0.12, -0.17, 0.13],
  [-0.08, 0.12, -0.12, 0.11],
  [0.12, 0.13, 0.15, 0.12],
  [-0.16, 0.1, -0.02, 0.1],
  [0.02, 0.32, 0.04, 0.1],
];

const SPIKES = 12;
const bodyScale = (size: number) => 0.7 + 0.2 * Math.min(size, 3);

export function createPathogenView(
  scene: THREE.Scene,
  tilePosition: (c: Coord) => THREE.Vector3,
): PathogenView {
  const group = new THREE.Group();
  scene.add(group);

  const sphereGeo = new THREE.SphereGeometry(1, 14, 10);
  const spikeGeo = new THREE.ConeGeometry(0.05, 0.3, 6);
  spikeGeo.translate(0, 0.15, 0);
  const rimGeo = new THREE.TorusGeometry(0.4, 0.045, 8, 28);
  rimGeo.rotateX(Math.PI / 2);
  const mats: Record<PathogenForm, THREE.MeshStandardMaterial> = {
    bacterium: new THREE.MeshStandardMaterial({
      color: FORM_COLOR.bacterium,
      roughness: 0.6,
    }),
    mold: new THREE.MeshStandardMaterial({
      color: FORM_COLOR.mold,
      roughness: 0.7,
    }),
  };
  const rimMat = new THREE.MeshStandardMaterial({
    color: RIM_COLOR,
    roughness: 0.3,
    metalness: 0.4,
  });

  interface Token {
    readonly root: THREE.Group;
    readonly body: THREE.Group;
    readonly badge: THREE.Sprite;
    readonly home: THREE.Vector3;
    size: number;
  }
  const tokens = new Map<PathogenId, Token>();
  const bodies: THREE.Object3D[] = [];
  let clock = 0;
  let growing = new Set<PathogenId>();
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

  const buildBody = (form: PathogenForm): THREE.Group => {
    const body = new THREE.Group();
    const mat = mats[form];
    if (form === "bacterium") {
      for (const [x, y, z, r] of CLUSTER) {
        const m = new THREE.Mesh(sphereGeo, mat);
        m.position.set(x, y, z);
        m.scale.setScalar(r);
        body.add(m);
      }
    } else {
      const core = new THREE.Mesh(sphereGeo, mat);
      core.position.y = 0.2;
      core.scale.setScalar(0.15);
      body.add(core);
      // Spikes fan out over the upper hemisphere (golden-angle spiral).
      for (let i = 0; i < SPIKES; i++) {
        const tilt = Math.acos(1 - (i + 0.5) / SPIKES);
        const spin = i * 2.399963;
        const spike = new THREE.Mesh(spikeGeo, mat);
        spike.position.set(0, 0.2, 0);
        spike.rotation.set(0, 0, 0);
        spike.quaternion.setFromEuler(
          new THREE.Euler(
            Math.sin(tilt) * Math.sin(spin) * 1.0,
            0,
            -Math.sin(tilt) * Math.cos(spin) * 1.0,
          ),
        );
        // Longer spikes on the sides, short on top, for a clearly spiky outline.
        spike.scale.set(1, 0.9 + 1.1 * Math.sin(tilt), 1);
        body.add(spike);
      }
    }
    return body;
  };

  const sizeToken = (t: Token, size: number) => {
    t.size = size;
    t.body.scale.setScalar(bodyScale(size));
    t.badge.material = labelMaterial(String(size), {
      background: "rgba(20,22,28,0.92)",
      round: true,
    });
    sizeLabel(t.badge, BADGE_HEIGHT);
  };

  const buildToken = (p: Pathogen): Token => {
    const def = PATHOGEN_KINDS[p.kind];
    const root = new THREE.Group();
    const body = buildBody(def.form);
    root.add(body);
    bodies.push(body);
    if (def.wall === "sealed") {
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.y = 0.05;
      root.add(rim);
    }
    const badge = new THREE.Sprite();
    badge.position.set(-0.3, 0.3, 0.32);
    badge.renderOrder = 12;
    root.add(badge);
    const home = tilePosition(p.at);
    root.position.copy(home);
    const t: Token = { root, body, badge, home, size: p.size };
    sizeToken(t, p.size);
    return t;
  };

  const clear = () => {
    group.clear();
    bodies.length = 0;
    tokens.clear();
  };

  return {
    group,
    update(state, pathogens = state.pathogens) {
      clear();
      for (const p of pathogens) {
        if (p.hidden) continue;
        const t = buildToken(p);
        tokens.set(p.id, t);
        group.add(t.root);
      }
    },
    setPose(id, scale, squash, dx, dy, dz) {
      const t = tokens.get(id);
      if (!t) return;
      t.root.visible = scale > 0.001;
      t.root.scale.set(
        scale / Math.sqrt(squash),
        scale * squash,
        scale / Math.sqrt(squash),
      );
      t.root.position.set(t.home.x + dx, t.home.y + dy, t.home.z + dz);
    },
    setSize(id, size) {
      const t = tokens.get(id);
      if (t && t.size !== size) sizeToken(t, size);
    },
    clearPoses() {
      for (const t of tokens.values()) {
        t.root.visible = true;
        t.root.scale.setScalar(1);
        t.root.position.copy(t.home);
      }
    },
    setGrowing(ids) {
      growing = new Set(ids);
    },
    tick(dt) {
      clock += dt;
      for (const [id, t] of tokens) {
        const swell = growing.has(id) && !calm.matches;
        const f = swell ? 1 + 0.045 * Math.sin(clock * 2.2) : 1;
        t.body.scale.setScalar(bodyScale(t.size) * f);
      }
      bodies.forEach((b, i) => {
        b.position.y = Math.sin(clock * 1.6 + i * 1.7) * 0.012;
      });
    },
  };
}
