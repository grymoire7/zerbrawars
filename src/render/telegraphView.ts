import * as THREE from "three";
import { telegraph, type TelegraphMark } from "../sim/battle/intents";
import { labelSprite } from "./labels";
import type { BattleState, Coord } from "../sim/types";

export interface TelegraphView {
  readonly group: THREE.Group;
  /** Redraws the given marks (default: state.intents with no orders). Reads only. */
  update(state: BattleState, marks?: readonly TelegraphMark[]): void;
  /** Fades the marks back (during playback) so the action reads over them. */
  setDim(dim: boolean): void;
}

// Shape carries the meaning (solid straight arrow = spread, dotted arc = spore, X + bar = blocked);
// color is secondary, with yellow vs blue differing in lightness as well as hue.
const SPREAD_COLOR = 0xffd23f;
const SPORE_COLOR = 0x6fb8ff;
const GROW_COLOR = 0xf2f2f2;
const BLOCKED_COLOR = 0xff5040;
const CANCELLED_COLOR = 0x8a8f9a;

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
    grow: mat(GROW_COLOR),
    blocked: mat(BLOCKED_COLOR),
    cancelled: new THREE.MeshBasicMaterial({
      color: CANCELLED_COLOR,
      depthTest: false,
      transparent: true,
      opacity: 0.55,
    }),
  };
  const baseOpacity = new Map<THREE.Material, number>(
    Object.values(mats).map((m) => [m, m.opacity] as const),
  );
  let dimmed = false;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
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
  const label = (text: string, at: THREE.Vector3, color: number) => {
    const sprite = labelSprite(text, LABEL_HEIGHT, { color: css(color) });
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

  const drawGrow = (m: TelegraphMark, size: number) => {
    const base = tileY(m.from, 0.95);
    add(
      coneGeo,
      mats.grow,
      base.clone().add(new THREE.Vector3(0, 0.2, 0)),
    ).quaternion.setFromUnitVectors(UP, UP);
    label(
      `grow ${size}\u2192${m.sizeAfter}`,
      base.clone().add(new THREE.Vector3(0, 0.62, 0)),
      GROW_COLOR,
    );
  };

  /** An engulfed pathogen's intent: faint dashes, no arrowhead, a small x where it would land. */
  const drawCancelled = (m: TelegraphMark) => {
    const a = tileY(m.from, LIFT);
    const mid = m.to
      ? a.clone().lerp(tileY(m.to, LIFT), 0.55)
      : a.clone().add(new THREE.Vector3(0, 0.45, 0));
    if (m.to) {
      const b = tileY(m.to, LIFT);
      const dir = b.clone().sub(a).setY(0).normalize();
      const from = a.clone().addScaledVector(dir, 0.3);
      const to = b.clone().addScaledVector(dir, -0.3);
      const n = Math.max(2, Math.round(from.distanceTo(to) / 0.3));
      for (let i = 0; i < n; i++) {
        segment(
          from.clone().lerp(to, (i + 0.1) / n),
          from.clone().lerp(to, (i + 0.6) / n),
          0.05,
          mats.cancelled,
        );
      }
    }
    label(
      "cancelled",
      mid.clone().add(new THREE.Vector3(0, 0.3, 0)),
      CANCELLED_COLOR,
    );
    const r = 0.14;
    for (const s of [-1, 1]) {
      segment(
        mid.clone().add(new THREE.Vector3(-r, 0, -r * s)),
        mid.clone().add(new THREE.Vector3(r, 0, r * s)),
        0.06,
        mats.cancelled,
      );
    }
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
        if (m.cancelledBy) drawCancelled(m);
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
