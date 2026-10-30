import * as THREE from "three";
import { PARAMS } from "../sim/params";
import type { BattleState, Coord, Swarm, SwarmId } from "../sim/types";

/**
 * Playback's hold on one swarm. Every field has a neutral value (see clearPoses), so a pose only
 * has to set what its beat changes. Cells never jump to a pose: they steer toward it.
 */
export interface SwarmPose {
  /** World points to stream along; null = stand on the state tile. */
  path: readonly THREE.Vector3[] | null;
  /** Cumulative length at each path point. */
  cum: readonly number[];
  /** 0..1 along the path. */
  progress: number;
  /** 0..1 how strung out the cells are behind the leader. */
  stream: number;
  /** 0..1 cells leave the anchor and wrap a shell around `wrapAt`. */
  wrap: number;
  readonly wrapAt: THREE.Vector3;
  /** Shell radius factor; below 1 squeezes the wrapped token. */
  wrapRadius: number;
  /** 0..1 bright kill flash. */
  flash: number;
  /** 0..1 loaded look, or -1 to follow state. */
  swell: number;
  /** Load count to show, or -1 to follow state. */
  load: number;
  /** 0..1 cells knocked outward (a blocked hit). */
  jolt: number;
}

export interface SwarmView {
  readonly group: THREE.Group;
  /** Syncs swarms to state (anchor tile, load look). Reads only; `snap` teleports the cells. */
  update(state: BattleState, snap?: boolean): void;
  /** The playback pose for a swarm, to write into this frame. */
  pose(id: SwarmId): SwarmPose | undefined;
  clearPoses(): void;
  /** Steers cells toward their targets and adds idle drift. */
  tick(dtSeconds: number): void;
}

const CELLS_PER_SWARM = 48;
const CLUSTER_RADIUS = 0.34;
const CELL_SIZE = 0.075;
const FREE_COLOR = new THREE.Color(0x9fd8f0);
const LOADED_COLOR = new THREE.Color(0x4f6b7a);
const FLASH_COLOR = new THREE.Color(0xffffff);
const CARGO_COLOR = 0x4a3480;
const LOADED_SWELL = 1.4;
/** How far (world units) the tail trails the leader mid-move. */
const STREAM_LENGTH = 1.1;
const SHELL_RADIUS = 0.36;

interface Entry {
  readonly mesh: THREE.InstancedMesh;
  readonly material: THREE.MeshStandardMaterial;
  /** Rest offset (x, z) per cell. */
  readonly rest: Float32Array;
  /** Drift phases (x, z) and speed per cell. */
  readonly phase: Float32Array;
  /** 0..1 place in the stream (0 = leader) and steering rate per cell. */
  readonly lag: Float32Array;
  readonly rate: Float32Array;
  /** Unit direction on the wrap shell per cell. */
  readonly shell: Float32Array;
  /** Current cell positions. */
  readonly pos: Float32Array;
  readonly label: THREE.Sprite;
  readonly cargo: THREE.Mesh[];
  readonly pose: SwarmPose;
  labelLoad: number;
  anchor: THREE.Vector3;
  load: number;
  /** Eases 0..1 toward the loaded look so dim/swell is not a pop. */
  swell: number;
  snap: boolean;
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

function labelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 48;
  const g = canvas.getContext("2d");
  if (g) {
    g.fillStyle = "rgba(26,28,34,0.85)";
    g.beginPath();
    g.roundRect(2, 2, 124, 44, 10);
    g.fill();
    g.fillStyle = "#e4e7ee";
    g.font = "bold 26px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 64, 25);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Writes the point `s` world units along `path` into `out`. */
function along(
  path: readonly THREE.Vector3[],
  cum: readonly number[],
  s: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const last = path.length - 1;
  if (s <= 0 || last === 0) return out.copy(path[0]!);
  if (s >= cum[last]!) return out.copy(path[last]!);
  let i = 1;
  while (cum[i]! < s) i++;
  const span = cum[i]! - cum[i - 1]!;
  return out.lerpVectors(
    path[i - 1]!,
    path[i]!,
    span > 0 ? (s - cum[i - 1]!) / span : 1,
  );
}

const NO_CUM: readonly number[] = [];

const neutral = (p: SwarmPose) => {
  p.path = null;
  p.cum = NO_CUM;
  p.progress = 0;
  p.stream = 0;
  p.wrap = 0;
  p.wrapRadius = 1;
  p.flash = 0;
  p.swell = -1;
  p.load = -1;
  p.jolt = 0;
};

export function createSwarmView(
  scene: THREE.Scene,
  tilePosition: (c: Coord) => THREE.Vector3,
): SwarmView {
  const group = new THREE.Group();
  scene.add(group);

  const cellGeo = new THREE.SphereGeometry(1, 10, 8);
  const cargoGeo = new THREE.IcosahedronGeometry(0.11, 0);
  const cargoMat = new THREE.MeshStandardMaterial({
    color: CARGO_COLOR,
    roughness: 0.8,
  });
  const entries = new Map<SwarmId, Entry>();
  const dummy = new THREE.Object3D();
  const lead = new THREE.Vector3();
  const cellAnchor = new THREE.Vector3();
  let clock = 0;

  const create = (swarm: Swarm): Entry => {
    const material = new THREE.MeshStandardMaterial({
      color: FREE_COLOR,
      roughness: 0.4,
    });
    const mesh = new THREE.InstancedMesh(cellGeo, material, CELLS_PER_SWARM);
    mesh.frustumCulled = false;
    const rnd = seeded(hash(swarm.id));
    const n = CELLS_PER_SWARM;
    const rest = new Float32Array(n * 2);
    const phase = new Float32Array(n * 3);
    const lag = new Float32Array(n);
    const rate = new Float32Array(n);
    const shell = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = CLUSTER_RADIUS * Math.sqrt(rnd());
      const a = rnd() * Math.PI * 2;
      rest[i * 2] = Math.cos(a) * r;
      rest[i * 2 + 1] = Math.sin(a) * r;
      phase[i * 3] = rnd() * Math.PI * 2;
      phase[i * 3 + 1] = rnd() * Math.PI * 2;
      phase[i * 3 + 2] = 0.6 + rnd() * 0.8;
      lag[i] = rnd();
      rate[i] = 7 + rnd() * 9;
      // Golden-spiral points over a dome, so wrapped cells cover the token evenly.
      const h = 0.08 + 0.92 * ((i + 0.5) / n);
      const ring = Math.sqrt(1 - h * h);
      const spin = i * 2.399963;
      shell[i * 3] = Math.cos(spin) * ring;
      shell[i * 3 + 1] = h;
      shell[i * 3 + 2] = Math.sin(spin) * ring;
    }
    group.add(mesh);
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ depthTest: false, transparent: true }),
    );
    label.scale.set(0.6, 0.225, 1);
    label.renderOrder = 12;
    label.visible = false;
    group.add(label);
    const cargo = Array.from({ length: PARAMS.loadCap }, () => {
      const m = new THREE.Mesh(cargoGeo, cargoMat);
      m.visible = false;
      group.add(m);
      return m;
    });
    const pose = { wrapAt: new THREE.Vector3() } as SwarmPose;
    neutral(pose);
    const loaded = swarm.load.length > 0;
    return {
      mesh,
      label,
      labelLoad: 0,
      cargo,
      material,
      rest,
      phase,
      lag,
      rate,
      shell,
      pos: new Float32Array(n * 3),
      pose,
      anchor: tilePosition(swarm.at),
      load: swarm.load.length,
      swell: loaded ? 1 : 0,
      snap: true,
    };
  };

  const setLabel = (e: Entry, load: number) => {
    if (load === e.labelLoad) return;
    e.labelLoad = load;
    const mat = e.label.material;
    mat.map?.dispose();
    mat.map = load > 0 ? labelTexture(`load ${load}/${PARAMS.loadCap}`) : null;
    mat.needsUpdate = true;
    e.label.visible = load > 0;
  };

  const step = (e: Entry, dt: number) => {
    const p = e.pose;
    // A posed swell is kept, so the look carries on smoothly once playback lets go.
    if (p.swell >= 0) e.swell = p.swell;
    const swell = e.swell;
    const load = p.load >= 0 ? p.load : e.load;
    if (p.path && p.path.length > 0) {
      along(p.path, p.cum, p.progress * p.cum[p.cum.length - 1]!, lead);
    } else lead.copy(e.anchor);

    const spread = (1 + (LOADED_SWELL - 1) * swell) * (1 - 0.45 * p.stream);
    const size = CELL_SIZE * (1 + 0.5 * swell);
    // Slower, smaller drift when loaded (a swollen swarm is sluggish).
    const amp = 0.05 * (1 - 0.5 * swell);
    const shellR = SHELL_RADIUS * p.wrapRadius * (1 + 0.15 * swell);
    const total = p.path ? p.cum[p.cum.length - 1]! : 0;
    const leadS = p.progress * total;
    for (let i = 0; i < CELLS_PER_SWARM; i++) {
      const lag = e.lag[i]!;
      if (p.path && p.stream > 0) {
        along(
          p.path,
          p.cum,
          leadS - lag * p.stream * STREAM_LENGTH,
          cellAnchor,
        );
      } else cellAnchor.copy(lead);
      const speed = e.phase[i * 3 + 2]!;
      const t = clock * speed;
      const px = e.phase[i * 3]!;
      const pz = e.phase[i * 3 + 1]!;
      const rx = e.rest[i * 2]!;
      const rz = e.rest[i * 2 + 1]!;
      const push = 1 + p.jolt * (0.6 + lag);
      let tx = cellAnchor.x + rx * spread * push + Math.sin(t + px) * amp;
      let ty =
        cellAnchor.y +
        size * 0.6 +
        0.02 +
        Math.sin(t * 1.3 + pz) * 0.012 +
        p.jolt * 0.12 * lag;
      let tz = cellAnchor.z + rz * spread * push + Math.cos(t + pz) * amp;
      if (p.wrap > 0) {
        // The front of the swarm (low lag) reaches the token first, so it pours on.
        const w = Math.min(1, Math.max(0, p.wrap * 1.6 - lag * 0.6));
        const wob = 1 + Math.sin(t * 2 + px) * 0.06;
        tx += (p.wrapAt.x + e.shell[i * 3]! * shellR * wob - tx) * w;
        ty += (p.wrapAt.y + e.shell[i * 3 + 1]! * shellR * wob - ty) * w;
        tz += (p.wrapAt.z + e.shell[i * 3 + 2]! * shellR * wob - tz) * w;
      }
      const k = e.snap ? 1 : 1 - Math.exp(-e.rate[i]! * dt);
      const o = i * 3;
      e.pos[o] = e.pos[o]! + (tx - e.pos[o]!) * k;
      e.pos[o + 1] = e.pos[o + 1]! + (ty - e.pos[o + 1]!) * k;
      e.pos[o + 2] = e.pos[o + 2]! + (tz - e.pos[o + 2]!) * k;
      dummy.position.set(e.pos[o]!, e.pos[o + 1]!, e.pos[o + 2]!);
      dummy.rotation.set(0, px + t * 0.3, 0);
      dummy.scale.set(size * 1.3, size * 0.6, size * 1.3);
      dummy.updateMatrix();
      e.mesh.setMatrixAt(i, dummy.matrix);
    }
    e.snap = false;
    e.mesh.instanceMatrix.needsUpdate = true;
    e.material.color.copy(FREE_COLOR).lerp(LOADED_COLOR, Math.min(1, swell));
    e.material.color.lerp(FLASH_COLOR, p.flash * 0.8);
    e.material.emissive.copy(FLASH_COLOR).multiplyScalar(p.flash * 0.9);

    // Label and cargo ride with the cells, wrapped or not.
    if (p.wrap > 0) lead.lerp(p.wrapAt, Math.min(1, p.wrap));
    e.label.position.set(lead.x, lead.y + 0.75, lead.z);
    setLabel(e, load);
    for (let c = 0; c < e.cargo.length; c++) {
      const m = e.cargo[c]!;
      m.visible = c < load;
      if (!m.visible) continue;
      const off = load > 1 ? (c - (load - 1) / 2) * 0.16 : 0;
      m.position.set(
        lead.x + off,
        lead.y + 0.11 + Math.sin(clock * 0.9 + c) * 0.01,
        lead.z,
      );
      m.rotation.set(clock * 0.3 + c, clock * 0.2, 0);
    }
  };

  return {
    group,
    update(state, snap = false) {
      const live = new Set<SwarmId>();
      for (const s of state.swarms) {
        live.add(s.id);
        let e = entries.get(s.id);
        if (!e) {
          e = create(s);
          entries.set(s.id, e);
        }
        e.anchor = tilePosition(s.at);
        e.load = s.load.length;
        if (snap) {
          e.snap = true;
          e.swell = e.load > 0 ? 1 : 0;
        }
        step(e, 0);
      }
      for (const [id, e] of entries) {
        if (live.has(id)) continue;
        group.remove(e.mesh);
        group.remove(e.label);
        for (const m of e.cargo) group.remove(m);
        e.label.material.map?.dispose();
        e.label.material.dispose();
        e.mesh.dispose();
        e.material.dispose();
        entries.delete(id);
      }
    },
    pose: (id) => entries.get(id)?.pose,
    clearPoses() {
      for (const e of entries.values()) neutral(e.pose);
    },
    tick(dt) {
      clock += dt;
      for (const e of entries.values()) {
        const target = e.load > 0 ? 1 : 0;
        e.swell +=
          Math.sign(target - e.swell) *
          Math.min(Math.abs(target - e.swell), dt * 3);
        step(e, dt);
      }
    },
  };
}
