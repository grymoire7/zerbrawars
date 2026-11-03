import * as THREE from "three";
import type { BattleState, Coord, Granuloma, GranulomaId } from "../sim/types";
import { hex } from "../theme/palette";

export interface GranulomaView {
  readonly group: THREE.Group;
  /**
   * Rebuilds granulomas from state's (or the list given). Reads only; never mutates state.
   * Playback passes extra not-yet-formed ones so it can grow them in.
   */
  update(state: BattleState, granulomas?: readonly Granuloma[]): void;
  /** Playback pose: uniform scale, 1 = at rest. */
  setPose(id: GranulomaId, scale: number): void;
  clearPoses(): void;
}

const WALL = hex("granuloma");
const WALL_DARK = hex("granuloma-dark");
const CORE = hex("granuloma-dark");

// Fixed blocky lumps (x, z, width, height, depth, yaw): a squat, chunky heap that reads as scar
// tissue and nothing like the round, spiky tokens or the loose cells of a swarm.
const LUMPS: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  number,
])[] = [
  [0, 0, 0.5, 0.34, 0.5, 0.3],
  [0.27, 0.1, 0.3, 0.22, 0.32, -0.4],
  [-0.26, 0.14, 0.32, 0.2, 0.28, 0.6],
  [0.08, -0.28, 0.34, 0.18, 0.3, 0.9],
  [-0.2, -0.24, 0.26, 0.14, 0.26, -0.2],
  [0.3, -0.24, 0.22, 0.12, 0.22, 0.5],
];

export function createGranulomaView(
  scene: THREE.Scene,
  tilePosition: (c: Coord) => THREE.Vector3,
): GranulomaView {
  const group = new THREE.Group();
  scene.add(group);

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const lumpMats = [WALL, WALL_DARK].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }),
  );
  const coreMat = new THREE.MeshStandardMaterial({
    color: CORE,
    roughness: 0.8,
  });
  const roots = new Map<GranulomaId, THREE.Group>();

  return {
    group,
    update(state, granulomas = state.granulomas) {
      group.clear();
      roots.clear();
      for (const g of granulomas) {
        const root = new THREE.Group();
        root.position.copy(tilePosition(g.at));
        LUMPS.forEach(([x, z, w, h, d, yaw], i) => {
          const m = new THREE.Mesh(boxGeo, lumpMats[i % 2]);
          m.position.set(x, h / 2, z);
          m.scale.set(w, h, d);
          m.rotation.y = yaw;
          root.add(m);
        });
        // The sealed contents peek out as a dark core.
        if (g.contents.length > 0) {
          const core = new THREE.Mesh(boxGeo, coreMat);
          core.position.set(0, 0.36, 0);
          core.scale.set(0.2, 0.08, 0.2);
          core.rotation.y = 0.8;
          root.add(core);
        }
        group.add(root);
        roots.set(g.id, root);
      }
    },
    setPose(id, scale) {
      roots.get(id)?.scale.setScalar(Math.max(scale, 0.001));
    },
    clearPoses() {
      for (const r of roots.values()) r.scale.setScalar(1);
    },
  };
}
