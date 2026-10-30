import * as THREE from "three";
import { PATHOGEN_KINDS, type PathogenForm } from "../sim/pathogens";
import type { BattleState, Coord, Pathogen } from "../sim/types";

export interface PathogenView {
  readonly group: THREE.Group;
  /** Rebuilds tokens from state. Reads only; never mutates it. */
  update(state: BattleState): void;
  /** Gentle idle bob so tokens read as alive. */
  tick(dtSeconds: number): void;
}

// Shape carries the growth form; the rim carries sealed vs leaky. Colors are secondary and chosen
// to differ in lightness as well as hue (orange vs violet), so red/green confusion does not matter.
const FORM_COLOR: Record<PathogenForm, number> = {
  bacterium: 0xe8a33d,
  mold: 0x6f4fb8,
};
const RIM_COLOR = 0xf4efe0;
const PIP_COLOR = 0xffffff;
const MAX_PIPS = 3;

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
  const pipGeo = new THREE.BoxGeometry(0.1, 0.05, 0.1);
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
  const pipMat = new THREE.MeshBasicMaterial({ color: PIP_COLOR });

  const bodies: THREE.Object3D[] = [];
  let clock = 0;

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

  const buildToken = (p: Pathogen): THREE.Group => {
    const def = PATHOGEN_KINDS[p.kind];
    const token = new THREE.Group();
    const body = buildBody(def.form);
    const s = 0.7 + 0.2 * Math.min(p.size, 3);
    body.scale.setScalar(s);
    token.add(body);
    bodies.push(body);
    if (def.wall === "sealed") {
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.position.y = 0.05;
      token.add(rim);
    }
    // Size pips: a row on the near edge of the tile.
    const pips = Math.min(Math.max(p.size, 1), MAX_PIPS);
    for (let i = 0; i < pips; i++) {
      const pip = new THREE.Mesh(pipGeo, pipMat);
      pip.position.set((i - (pips - 1) / 2) * 0.16, 0.03, 0.44);
      token.add(pip);
    }
    token.position.copy(tilePosition(p.at));
    return token;
  };

  const clear = () => {
    group.clear();
    bodies.length = 0;
  };

  return {
    group,
    update(state) {
      clear();
      for (const p of state.pathogens) {
        if (!p.hidden) group.add(buildToken(p));
      }
    },
    tick(dt) {
      clock += dt;
      bodies.forEach((b, i) => {
        b.position.y = Math.sin(clock * 1.6 + i * 1.7) * 0.012;
      });
    },
  };
}
