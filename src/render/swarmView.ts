import * as THREE from "three";
import type { BattleState, Coord, Swarm, SwarmId } from "../sim/types";

export interface SwarmView {
  readonly group: THREE.Group;
  /** Syncs swarms to state (anchor tile, load look). Reads only; never mutates it. */
  update(state: BattleState): void;
  /** Idle drift around each anchor. */
  tick(dtSeconds: number): void;
}

const CELLS_PER_SWARM = 48;
const CLUSTER_RADIUS = 0.34;
const CELL_SIZE = 0.075;
const FREE_COLOR = new THREE.Color(0x9fd8f0);
const LOADED_COLOR = new THREE.Color(0x4f6b7a);
const LOADED_SWELL = 1.4;

interface Entry {
  readonly mesh: THREE.InstancedMesh;
  readonly material: THREE.MeshStandardMaterial;
  /** Rest offset (x, z) and phases per cell. */
  readonly rest: Float32Array;
  readonly phase: Float32Array;
  anchor: THREE.Vector3;
  loaded: boolean;
  /** Eases 0..1 toward `loaded` so dim/swell is not a pop. */
  swell: number;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seeded(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSwarmView(
  scene: THREE.Scene,
  tilePosition: (c: Coord) => THREE.Vector3,
): SwarmView {
  const group = new THREE.Group();
  scene.add(group);

  // Flat discs: unlike the spherical pathogen parts, cells read as pale lozenges.
  const cellGeo = new THREE.SphereGeometry(1, 10, 8);
  const entries = new Map<SwarmId, Entry>();
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  let clock = 0;

  const create = (swarm: Swarm): Entry => {
    const material = new THREE.MeshStandardMaterial({
      color: FREE_COLOR,
      roughness: 0.4,
    });
    const mesh = new THREE.InstancedMesh(cellGeo, material, CELLS_PER_SWARM);
    mesh.frustumCulled = false;
    const rnd = seeded(hash(swarm.id));
    const rest = new Float32Array(CELLS_PER_SWARM * 2);
    const phase = new Float32Array(CELLS_PER_SWARM * 3);
    for (let i = 0; i < CELLS_PER_SWARM; i++) {
      const r = CLUSTER_RADIUS * Math.sqrt(rnd());
      const a = rnd() * Math.PI * 2;
      rest[i * 2] = Math.cos(a) * r;
      rest[i * 2 + 1] = Math.sin(a) * r;
      phase[i * 3] = rnd() * Math.PI * 2;
      phase[i * 3 + 1] = rnd() * Math.PI * 2;
      phase[i * 3 + 2] = 0.6 + rnd() * 0.8;
    }
    group.add(mesh);
    return {
      mesh,
      material,
      rest,
      phase,
      anchor: tilePosition(swarm.at),
      loaded: swarm.load.length > 0,
      swell: swarm.load.length > 0 ? 1 : 0,
    };
  };

  const pose = (e: Entry) => {
    const spread = 1 + (LOADED_SWELL - 1) * e.swell;
    const size = CELL_SIZE * (1 + 0.5 * e.swell);
    for (let i = 0; i < CELLS_PER_SWARM; i++) {
      const speed = e.phase[i * 3 + 2]!;
      const t = clock * speed;
      // Slower, smaller drift when loaded (a swollen swarm is sluggish).
      const amp = 0.05 * (1 - 0.5 * e.swell);
      const px = e.phase[i * 3]!;
      const pz = e.phase[i * 3 + 1]!;
      dummy.position.set(
        e.anchor.x + e.rest[i * 2]! * spread + Math.sin(t + px) * amp,
        e.anchor.y + size * 0.6 + 0.02 + Math.sin(t * 1.3 + pz) * 0.012,
        e.anchor.z + e.rest[i * 2 + 1]! * spread + Math.cos(t + pz) * amp,
      );
      dummy.rotation.set(0, px + t * 0.3, 0);
      dummy.scale.set(size * 1.3, size * 0.6, size * 1.3);
      dummy.updateMatrix();
      e.mesh.setMatrixAt(i, dummy.matrix);
    }
    e.mesh.instanceMatrix.needsUpdate = true;
    tmpColor.copy(FREE_COLOR).lerp(LOADED_COLOR, e.swell);
    e.material.color.copy(tmpColor);
  };

  return {
    group,
    update(state) {
      const live = new Set<SwarmId>();
      for (const s of state.swarms) {
        live.add(s.id);
        let e = entries.get(s.id);
        if (!e) {
          e = create(s);
          entries.set(s.id, e);
        }
        e.anchor = tilePosition(s.at);
        e.loaded = s.load.length > 0;
        pose(e);
      }
      for (const [id, e] of entries) {
        if (live.has(id)) continue;
        group.remove(e.mesh);
        e.mesh.dispose();
        e.material.dispose();
        entries.delete(id);
      }
    },
    tick(dt) {
      clock += dt;
      for (const e of entries.values()) {
        const target = e.loaded ? 1 : 0;
        e.swell +=
          Math.sign(target - e.swell) *
          Math.min(Math.abs(target - e.swell), dt * 3);
        pose(e);
      }
    },
  };
}
