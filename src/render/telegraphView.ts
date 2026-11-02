import * as THREE from "three";
import { telegraph, type TelegraphMark } from "../sim/battle/intents";
import { labelSprite } from "./labels";
import type { BattleState, Coord } from "../sim/types";
import { hex } from "../theme/palette";

export interface TelegraphView {
  readonly group: THREE.Group;
  /** Redraws the given marks (default: state.intents with no orders). Reads only. */
  update(state: BattleState, marks?: readonly TelegraphMark[]): void;
  /** Fades the marks back (during playback) so the action reads over them. */
  setDim(dim: boolean): void;
}

// Shape carries the meaning (solid straight arrow = spread, dotted arc = spore, X + bar = blocked);
// color is secondary, with yellow vs blue differing in lightness as well as hue.
const SPREAD_COLOR = hex("spread");
const SPORE_COLOR = hex("spore");
const GROW_COLOR = hex("grow");
const BLOCKED_COLOR = hex("blocked");
const STALL_COLOR = hex("stall");
const HALO_COLOR = hex("mark-halo");

const LIFT = 0.5;
const LABEL_HEIGHT = 0.26;
const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

export function createTelegraphView(
  scene: THREE.Scene,
  tilePosition: (c: Coord) => THREE.Vector3,
): TelegraphView {
  const group = new THREE.Group();
  scene.add(group);

  // Drawn over tokens (no depth test) so an arrow is never hidden behind a pathogen.
  const mat = (color: number) =>
    new THREE.MeshBasicMaterial({
      color,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
    });
  const mats = {
    spread: mat(SPREAD_COLOR),
    spore: mat(SPORE_COLOR),
    ghost: new THREE.MeshBasicMaterial({
      color: GROW_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.12,
    }),
    ghostRing: new THREE.MeshBasicMaterial({
      color: GROW_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    }),
    blocked: mat(BLOCKED_COLOR),
    stall: mat(STALL_COLOR),
    halo: new THREE.MeshBasicMaterial({
      color: HALO_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.8,
    }),
  };
  const baseOpacity = new Map<THREE.Material, number>(
    Object.values(mats).map((m) => [m, m.opacity] as const),
  );
  let dimmed = false;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const ghostGeo = new THREE.SphereGeometry(1, 20, 14);
  const ringGeo = new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2);
  const coneGeo = new THREE.ConeGeometry(0.18, 0.34, 3);
  const diamondGeo = new THREE.OctahedronGeometry(0.17);
  const dotGeo = new THREE.SphereGeometry(0.06, 8, 6);

  const add = (
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    at: THREE.Vector3,
  ) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.copy(at);
    mesh.renderOrder = 10;
    group.add(mesh);
    // Dark halo under each solid mark (spec 4.2) so spore and blocked stay above 3:1 on hot tiles.
    if (m !== mats.ghost && m !== mats.ghostRing) {
      const h = new THREE.Mesh(geo, mats.halo);
      if (geo === boxGeo) h.scale.set(1.1, 2.1, 2.1);
      else h.scale.setScalar(1.5);
      h.renderOrder = 9.5;
      mesh.add(h);
    }
    return mesh;
  };

  const segment = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    width: number,
    m: THREE.Material,
  ) => {
    const dir = b.clone().sub(a);
    const len = dir.length();
    if (len < 1e-6) return;
    const mesh = add(boxGeo, m, a.clone().add(b).multiplyScalar(0.5));
    mesh.scale.set(len, width, width);
    mesh.quaternion.setFromUnitVectors(X_AXIS, dir.normalize());
  };

  // Text beside an arrow says what it is; the sprite materials are shared, so dimming tracks them.
  const label = (
    text: string,
    at: THREE.Vector3,
    color: number,
    height = LABEL_HEIGHT,
  ) => {
    const sprite = labelSprite(text, height, { color: css(color) });
    if (!baseOpacity.has(sprite.material)) baseOpacity.set(sprite.material, 1);
    sprite.material.opacity = dimmed ? 0.35 : 1;
    sprite.position.copy(at);
    group.add(sprite);
  };

  const tileY = (c: Coord, y: number) =>
    tilePosition(c).add(new THREE.Vector3(0, y, 0));

  /** Square outline on the target tile; spores get corner brackets only. */
  const outline = (c: Coord, m: THREE.Material, brackets: boolean) => {
    const o = tileY(c, 0.03);
    const h = 0.44;
    const corners = [
      [-h, -h],
      [h, -h],
      [h, h],
      [-h, h],
    ] as const;
    corners.forEach(([x, z], i) => {
      const [nx, nz] = corners[(i + 1) % 4]!;
      const a = o.clone().add(new THREE.Vector3(x, 0, z));
      const b = o.clone().add(new THREE.Vector3(nx, 0, nz));
      if (!brackets) return segment(a, b, 0.05, m);
      segment(a, a.clone().lerp(b, 0.3), 0.06, m);
      segment(b, b.clone().lerp(a, 0.3), 0.06, m);
    });
  };

  const cross = (c: Coord) => {
    const o = tileY(c, 0.05);
    const r = 0.3;
    segment(
      o.clone().add(new THREE.Vector3(-r, 0, -r)),
      o.clone().add(new THREE.Vector3(r, 0, r)),
      0.08,
      mats.blocked,
    );
    segment(
      o.clone().add(new THREE.Vector3(-r, 0, r)),
      o.clone().add(new THREE.Vector3(r, 0, -r)),
      0.08,
      mats.blocked,
    );
  };

  /** Perpendicular stop bar at `p`, across the horizontal direction `dir`. */
  const stopBar = (p: THREE.Vector3, dir: THREE.Vector3) => {
    const side = new THREE.Vector3(-dir.z, 0, dir.x)
      .normalize()
      .multiplyScalar(0.28);
    segment(p.clone().sub(side), p.clone().add(side), 0.1, mats.blocked);
  };

  // The pending size, as a faint ghost sphere and ground ring around the token (which also swells).
  const drawGrow = (m: TelegraphMark, size: number) => {
    const base = tileY(m.from, 0);
    const r = 0.5 * (0.7 + 0.2 * Math.min(m.sizeAfter, 3));
    const ghost = add(
      ghostGeo,
      mats.ghost,
      base.clone().add(new THREE.Vector3(0, 0.2, 0)),
    );
    ghost.scale.setScalar(r);
    ghost.renderOrder = 9;
    const ring = add(
      ringGeo,
      mats.ghostRing,
      base.clone().add(new THREE.Vector3(0, 0.03, 0)),
    );
    ring.scale.setScalar(r);
    label(
      `grow ${size}\u2192${m.sizeAfter}`,
      tileY(m.from, 0.95),
      GROW_COLOR,
      0.2,
    );
  };

  // Held back by medication: a calm pause sign and a label, nothing that reads as an action.
  const drawStall = (m: TelegraphMark) => {
    for (const dx of [-0.07, 0.07]) {
      const bar = add(boxGeo, mats.stall, tileY(m.from, 0.78));
      bar.position.x += dx;
      bar.scale.set(0.06, 0.2, 0.06);
    }
    label("stalled", tileY(m.from, 1.02), STALL_COLOR, 0.2);
  };

  const drawSpread = (m: TelegraphMark, to: Coord) => {
    const a = tileY(m.from, LIFT);
    const b = tileY(to, LIFT);
    const dir = b.clone().sub(a).setY(0).normalize();
    const start = a.clone().addScaledVector(dir, 0.3);
    if (m.blockedBy) {
      const end = b.clone().addScaledVector(dir, -0.55);
      segment(start, end, 0.07, mats.spread);
      stopBar(end, dir);
      cross(to);
      outline(to, mats.blocked, false);
      label("blocked", tileY(to, 0.75), BLOCKED_COLOR);
      return;
    }
    const tip = b.clone().addScaledVector(dir, -0.3);
    segment(start, tip, 0.07, mats.spread);
    const head = add(
      coneGeo,
      mats.spread,
      b.clone().addScaledVector(dir, -0.4),
    );
    head.quaternion.setFromUnitVectors(UP, dir);
    outline(to, mats.spread, false);
    label(
      "spread",
      a
        .clone()
        .lerp(b, 0.5)
        .add(new THREE.Vector3(0, 0.3, 0)),
      SPREAD_COLOR,
    );
  };

  const drawSpore = (m: TelegraphMark, to: Coord) => {
    const a = tileY(m.from, LIFT);
    const b = tileY(to, LIFT);
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const peak = 0.4 + dist * 0.22;
    const at = (t: number) =>
      new THREE.Vector3(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t + 4 * peak * t * (1 - t),
        a.z + (b.z - a.z) * t,
      );
    const steps = Math.max(8, Math.round(dist * 5));
    const end = m.blockedBy ? 0.8 : 1;
    for (let i = 1; i < steps * end; i++)
      add(dotGeo, mats.spore, at(i / steps));
    if (m.blockedBy) {
      const dir = b.clone().sub(a).setY(0).normalize();
      stopBar(at(end), dir);
      cross(to);
      outline(to, mats.blocked, true);
      label("blocked", tileY(to, 0.75), BLOCKED_COLOR);
      return;
    }
    add(diamondGeo, mats.spore, at(1));
    outline(to, mats.spore, true);
    label("spore", at(0.5).add(new THREE.Vector3(0, 0.25, 0)), SPORE_COLOR);
  };

  return {
    group,
    update(state, marks = telegraph(state)) {
      group.clear();
      for (const m of marks) {
        if (m.cancelledBy || m.cancelledByCharge) continue;
        if (m.type === "stall") drawStall(m);
        else if (m.type === "grow" || !m.to) {
          const size = state.pathogens.find((p) => p.id === m.pathogenId)?.size;
          drawGrow(m, size ?? m.sizeAfter);
        } else if (m.type === "spread") drawSpread(m, m.to);
        else drawSpore(m, m.to);
      }
    },
    setDim(dim) {
      dimmed = dim;
      for (const [m, o] of baseOpacity) m.opacity = dim ? o * 0.35 : o;
    },
  };
}
