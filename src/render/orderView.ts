import * as THREE from "three";
import { movePath, type EngulfTarget } from "../sim/battle/orders";
import type { BattleState, Coord, Order } from "../sim/types";
import { ORDER_COLOR } from "./boardView";

export interface OrderView {
  readonly group: THREE.Group;
  /**
   * Redraws ghosts for the pending orders and a reticle on each engulf target. Reads only; never
   * mutates state.
   */
  update(
    state: BattleState,
    orders: readonly Order[],
    targets?: readonly EngulfTarget[],
  ): void;
}

const LIFT = 0.1;
const GHOST_CELLS = 20;
const GHOST_RADIUS = 0.3;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

export function createOrderView(
  scene: THREE.Scene,
  tilePosition: (c: Coord) => THREE.Vector3,
): OrderView {
  const group = new THREE.Group();
  scene.add(group);

  const solid = new THREE.MeshBasicMaterial({
    color: ORDER_COLOR,
    depthTest: false,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  const ghost = new THREE.MeshBasicMaterial({
    color: 0x9fd8f0,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const ringGeo = new THREE.RingGeometry(0.34, 0.44, 24);
  const dotGeo = new THREE.CircleGeometry(0.1, 12);
  const reticleGeo = new THREE.RingGeometry(0.47, 0.51, 32);
  const coneGeo = new THREE.ConeGeometry(0.16, 0.3, 3);
  const cellGeo = new THREE.SphereGeometry(1, 8, 6);

  // Fixed scatter so the ghost cluster does not shimmer between redraws.
  const scatter = Array.from({ length: GHOST_CELLS }, (_, i) => {
    const a = i * 2.399963;
    const r = GHOST_RADIUS * Math.sqrt((i + 0.5) / GHOST_CELLS);
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  });

  const place = (mesh: THREE.Mesh, at: THREE.Vector3, order = 11) => {
    mesh.position.copy(at);
    mesh.renderOrder = order;
    group.add(mesh);
    return mesh;
  };

  const flat = (geo: THREE.BufferGeometry, at: THREE.Vector3) => {
    const m = place(new THREE.Mesh(geo, solid), at);
    m.rotation.x = -Math.PI / 2;
  };

  const dash = (a: THREE.Vector3, b: THREE.Vector3) => {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const n = Math.max(1, Math.round(len / 0.3));
    dir.normalize();
    for (let i = 0; i < n; i++) {
      const from = a.clone().lerp(b, (i + 0.15) / n);
      const to = a.clone().lerp(b, (i + 0.75) / n);
      const m = place(
        new THREE.Mesh(boxGeo, solid),
        from.clone().add(to).multiplyScalar(0.5),
      );
      m.scale.set(from.distanceTo(to), 0.04, 0.09);
      m.quaternion.setFromUnitVectors(X_AXIS, dir);
    }
  };

  const at = (c: Coord, y = LIFT) =>
    tilePosition(c).add(new THREE.Vector3(0, y, 0));

  const drawMove = (path: readonly Coord[]) => {
    for (let i = 1; i < path.length; i++) {
      dash(at(path[i - 1]!), at(path[i]!));
    }
    const to = path[path.length - 1]!;
    flat(ringGeo, at(to, LIFT + 0.01));
    flat(dotGeo, at(to, LIFT + 0.01));
    const base = at(to, 0.07);
    for (const [x, z] of scatter) {
      const m = place(new THREE.Mesh(cellGeo, ghost), base, 9);
      m.position.x += x;
      m.position.z += z;
      m.scale.set(0.09, 0.045, 0.09);
    }
  };

  // Two upright bars over the swarm: a pause sign, unlike any telegraph mark.
  const drawHold = (c: Coord) => {
    for (const dx of [-0.07, 0.07]) {
      const m = place(new THREE.Mesh(boxGeo, solid), at(c, 0.85));
      m.position.x += dx;
      m.scale.set(0.07, 0.3, 0.07);
    }
  };

  // Crosshair: a thin circle with four ticks crossing it, unlike the telegraph's squares and the
  // move discs. The queued target also gets a heavier inner ring.
  const drawReticle = (c: Coord, queued: boolean) => {
    const o = at(c, 0.04);
    flat(reticleGeo, o);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const m = place(new THREE.Mesh(boxGeo, solid), o);
      m.position.x += dx * 0.45;
      m.position.z += dz * 0.45;
      m.scale.set(dx ? 0.2 : 0.05, 0.05, dz ? 0.2 : 0.05);
    }
    if (queued) flat(ringGeo, at(c, 0.05));
  };

  const drawEngulf = (from: Coord, to: Coord) => {
    const a = at(from, 0.5);
    const b = at(to, 0.5);
    const dir = b.clone().sub(a).setY(0).normalize();
    const start = a.clone().addScaledVector(dir, 0.3);
    const tip = b.clone().addScaledVector(dir, -0.45);
    const seg = tip.clone().sub(start);
    const len = Math.max(seg.length(), 0.05);
    const body = place(
      new THREE.Mesh(boxGeo, solid),
      start.clone().add(tip).multiplyScalar(0.5),
    );
    body.scale.set(len, 0.08, 0.08);
    body.quaternion.setFromUnitVectors(X_AXIS, dir);
    const head = place(
      new THREE.Mesh(coneGeo, solid),
      b.clone().addScaledVector(dir, -0.4),
    );
    head.quaternion.setFromUnitVectors(UP, dir);
  };

  return {
    group,
    update(state, orders, targets = []) {
      group.clear();
      const queued = new Set(
        orders.flatMap((o) => (o.type === "engulf" ? [o.pathogenId] : [])),
      );
      for (const t of targets) {
        const p = state.pathogens.find((q) => q.id === t.pathogenId);
        if (p) drawReticle(p.at, queued.has(p.id));
      }
      for (const o of orders) {
        const swarm = state.swarms.find((s) => s.id === o.swarmId);
        if (!swarm) continue;
        if (o.type === "hold") drawHold(swarm.at);
        else if (o.type === "move") {
          const path = movePath(state, swarm.id, o.to);
          if (path) drawMove(path);
        } else if (o.type === "engulf") {
          const p = state.pathogens.find((q) => q.id === o.pathogenId);
          if (!p) continue;
          let end = swarm.at;
          if (o.from) {
            const path = movePath(state, swarm.id, o.from);
            if (path) {
              drawMove(path);
              end = o.from;
            }
          }
          drawEngulf(end, p.at);
        }
      }
    },
  };
}
