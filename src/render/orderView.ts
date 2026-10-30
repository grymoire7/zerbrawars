import * as THREE from "three";
import { movePath } from "../sim/battle/orders";
import type { BattleState, Coord, Order } from "../sim/types";
import { ORDER_COLOR } from "./boardView";

export interface OrderView {
  readonly group: THREE.Group;
  /** Redraws ghosts for the pending orders. Reads only; never mutates state. */
  update(state: BattleState, orders: readonly Order[]): void;
}

const LIFT = 0.1;
const GHOST_CELLS = 20;
const GHOST_RADIUS = 0.3;
const X_AXIS = new THREE.Vector3(1, 0, 0);

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

  return {
    group,
    update(state, orders) {
      group.clear();
      for (const o of orders) {
        const swarm = state.swarms.find((s) => s.id === o.swarmId);
        if (!swarm) continue;
        if (o.type === "hold") drawHold(swarm.at);
        else if (o.type === "move") {
          const path = movePath(state, swarm.id, o.to);
          if (path) drawMove(path);
        }
      }
    },
  };
}
