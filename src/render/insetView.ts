import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PARAMS } from "../sim/params";
import { pathogenKind, type PathogenKindId } from "../sim/pathogens";
import type { BattleState, Coord } from "../sim/types";
import { createAuraView } from "./auraView";
import { createBoardView } from "./boardView";
import { FORM_COLOR } from "./pathogenView";

/** The body inset for the life screen: the slab at reduced detail, the aura, and preview dots. */
export interface InsetView {
  /** Medication level, 0..1. The shown aura eases toward it (or snaps under reduced motion). */
  setAura(level: number): void;
  /** Dots drifting in from the nearest board edge toward `entry`; null clears them. */
  setPreview(
    p: {
      readonly kind: PathogenKindId;
      readonly count: number;
      readonly entry: Coord;
    } | null,
  ): void;
  /** Carried reservoirs the sim reports; hidden ones are faint rings. */
  setReservoirs(
    list: readonly {
      readonly kind: PathogenKindId;
      readonly hidden: boolean;
      readonly at?: Coord;
    }[],
  ): void;
  /** The aura level on screen right now (for tests and the live label). */
  shownAura(): number;
  tick(dtSeconds: number): void;
  dispose(): void;
}

const MAX_DOTS = 40;
const DOT = 0.11;
const RIM_COLOR = 0xf4efe0;
const AURA_RATE = 0.35;
const DRIFT_SPEED = 0.22;
const SPREAD = 0.8;

/** Spiky mold silhouette as one geometry so a whole stream is a single instanced draw. */
function moldGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.SphereGeometry(0.55, 8, 6)];
  const up = new THREE.Vector3(0, 1, 0);
  const spikes = 9;
  for (let i = 0; i < spikes; i++) {
    const y = 1 - (2 * (i + 0.5)) / spikes;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.399963;
    const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const cone = new THREE.ConeGeometry(0.2, 0.7, 5);
    cone.translate(0, 0.65, 0);
    cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    parts.push(cone);
  }
  return mergeGeometries(parts) ?? parts[0];
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export function createInsetView(
  root: THREE.Scene,
  state: BattleState,
): InsetView {
  const { board } = state;
  const board3 = createBoardView(root, state);
  const extent = { width: board.width, depth: board.height };
  // Two stacked layers and a curve (level^1.6) so a dropped dose reads at a glance in the inset.
  const auras = [createAuraView(root, extent), createAuraView(root, extent)];
  const showAura = (level: number) => {
    for (const a of auras) a.setAura(level ** 1.6);
  };
  const group = new THREE.Group();
  root.add(group);
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

  const dummy = new THREE.Object3D();
  const bodyMat = (form: "bacterium" | "mold") =>
    new THREE.MeshStandardMaterial({
      color: FORM_COLOR[form],
      roughness: 0.6,
      emissive: FORM_COLOR[form],
      emissiveIntensity: 0.25,
    });
  const bodies = {
    bacterium: new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.8, 10, 8),
      bodyMat("bacterium"),
      MAX_DOTS,
    ),
    mold: new THREE.InstancedMesh(moldGeometry(), bodyMat("mold"), MAX_DOTS),
  };
  const rimGeo = new THREE.TorusGeometry(1.05, 0.14, 6, 18);
  rimGeo.rotateX(Math.PI / 2);
  const rims = new THREE.InstancedMesh(
    rimGeo,
    new THREE.MeshStandardMaterial({
      color: RIM_COLOR,
      roughness: 0.3,
      metalness: 0.4,
    }),
    MAX_DOTS,
  );
  for (const m of [bodies.bacterium, bodies.mold, rims]) {
    m.count = 0;
    m.frustumCulled = false;
    group.add(m);
  }

  let preview: {
    form: "bacterium" | "mold";
    sealed: boolean;
    count: number;
    from: THREE.Vector3;
    to: THREE.Vector3;
    side: THREE.Vector3;
  } | null = null;
  let clock = 0;

  const place = (t: number, i: number, sc: number) => {
    if (!preview) return;
    const jitter = hash(i + 1) - 0.5;
    const lift = hash(i + 91);
    const k = Math.min(1, Math.max(0, t));
    const grow = Math.sin(Math.PI * k) ** 0.6;
    dummy.position
      .copy(preview.from)
      .lerp(preview.to, k)
      .addScaledVector(preview.side, jitter * SPREAD * 2 * (1 - 0.5 * k));
    dummy.position.y = 0.18 + lift * 0.25;
    dummy.rotation.set(0, hash(i + 5) * 6.28, 0);
    dummy.scale.setScalar(DOT * (0.4 + 0.6 * grow) * sc * 1.6);
    dummy.updateMatrix();
  };

  const draw = () => {
    for (const m of [bodies.bacterium, bodies.mold, rims]) m.count = 0;
    if (!preview) return;
    const body = bodies[preview.form];
    body.count = preview.count;
    rims.count = preview.sealed ? preview.count : 0;
    for (let i = 0; i < preview.count; i++) {
      // Reduced motion: dots sit evenly along the path instead of drifting.
      const t = calm.matches
        ? (i + 0.5) / preview.count
        : (i / preview.count + clock * DRIFT_SPEED) % 1;
      place(t, i, 1);
      body.setMatrixAt(i, dummy.matrix);
      if (preview.sealed) rims.setMatrixAt(i, dummy.matrix);
    }
    body.instanceMatrix.needsUpdate = true;
    rims.instanceMatrix.needsUpdate = true;
  };

  const markers = new THREE.Group();
  group.add(markers);

  let target = 0;
  let shown = 0;
  let first = true;

  return {
    setAura(level) {
      target = Math.min(1, Math.max(0, level));
      if (first || calm.matches) {
        shown = target;
        first = false;
        showAura(shown);
      }
    },
    setPreview(p) {
      if (!p) {
        preview = null;
        draw();
        return;
      }
      const kind = pathogenKind(p.kind);
      const to = board3.tilePosition(p.entry).clone();
      const toLeft = p.entry.x;
      const toRight = board.width - 1 - p.entry.x;
      const toTop = p.entry.y;
      const toBottom = board.height - 1 - p.entry.y;
      const near = Math.min(toLeft, toRight, toTop, toBottom);
      const from = to.clone();
      const out = near + 1.6;
      if (near === toLeft) from.x -= out;
      else if (near === toRight) from.x += out;
      else if (near === toTop) from.z -= out;
      else from.z += out;
      const along = to.clone().sub(from).normalize();
      preview = {
        form: kind.form,
        sealed: kind.wall === "sealed",
        count: Math.min(MAX_DOTS, p.count),
        from,
        to,
        side: new THREE.Vector3(-along.z, 0, along.x),
      };
      draw();
    },
    setReservoirs(list) {
      markers.clear();
      list.forEach((r, i) => {
        const at = r.at ?? PARAMS.setup.reservoirTiles[i];
        if (!at) return;
        const kind = pathogenKind(r.kind);
        const mat = new THREE.MeshBasicMaterial({
          color: FORM_COLOR[kind.form],
          transparent: true,
          opacity: r.hidden ? 0.28 : 0.85,
          depthWrite: false,
        });
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), mat);
        m.position.copy(board3.tilePosition(at)).setY(0.25);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.4, 0.04, 6, 24).rotateX(Math.PI / 2),
          new THREE.MeshBasicMaterial({
            color: RIM_COLOR,
            transparent: true,
            opacity: r.hidden ? 0.5 : 0.9,
          }),
        );
        ring.position.copy(m.position);
        markers.add(m, ring);
      });
    },
    shownAura: () => shown,
    tick(dt) {
      clock += dt;
      if (shown !== target) {
        const step = AURA_RATE * dt;
        shown =
          Math.abs(target - shown) <= step
            ? target
            : shown + Math.sign(target - shown) * step;
        showAura(shown);
      }
      for (const a of auras) a.tick(dt);
      if (preview && !calm.matches) draw();
    },
    dispose() {
      root.remove(board3.group, ...auras.map((a) => a.group), group);
    },
  };
}
