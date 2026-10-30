import * as THREE from "three";
import { coordOf, inBounds, sameCoord, tileId } from "../sim/board";
import { PARAMS } from "../sim/params";
import type { BattleState, Coord } from "../sim/types";

const TILE = 1;
const GAP = 0.06;
const TILE_HEIGHT = 0.2;

const BASE_A = new THREE.Color(0x8d7a78);
const BASE_B = new THREE.Color(0x84716f);
const INFLAMED = new THREE.Color(0xc4554a);
const HOVER_TINT = new THREE.Color(0xffffff);
const PULSE_TINT = new THREE.Color(0xff8a5c);
const SLAB = 0x3a2f31;
// Order UI: magenta-violet, apart from the telegraph's yellow/blue/red/white. Shape carries it too:
// a thick solid frame for the selection, filled discs with a ring for destinations.
export const ORDER_COLOR = 0xd05cff;

export interface BoardView {
  readonly group: THREE.Group;
  /** Recolors tiles from state. Reads only; never mutates it. */
  update(state: BattleState): void;
  /** `pointer` is in normalized device coords (-1..1, y up). */
  pick(pointer: { x: number; y: number }, camera: THREE.Camera): Coord | null;
  setHover(coord: Coord | null): void;
  setSelected(coord: Coord | null): void;
  /** Marks legal destination tiles for the selected swarm. */
  setOptions(coords: readonly Coord[]): void;
  /** Playback: 0..1 warm tint on a tile (inflammation change or summary pulse). */
  setPulse(coord: Coord, amount: number): void;
  clearPulses(): void;
  /** Centre of a tile in world space (y = top surface), for later views to place things. */
  tilePosition(coord: Coord): THREE.Vector3;
}

export function createBoardView(
  scene: THREE.Scene,
  state: BattleState,
): BoardView {
  const { board } = state;
  const group = new THREE.Group();
  scene.add(group);

  const toWorld = (c: Coord, y = 0) =>
    new THREE.Vector3(
      (c.x - (board.width - 1) / 2) * TILE,
      y,
      (c.y - (board.height - 1) / 2) * TILE,
    );

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(
      board.width * TILE + 0.3,
      0.3,
      board.height * TILE + 0.3,
    ),
    new THREE.MeshStandardMaterial({ color: SLAB, roughness: 1 }),
  );
  slab.position.y = -TILE_HEIGHT - 0.15;
  group.add(slab);

  const tileGeo = new THREE.BoxGeometry(TILE - GAP, TILE_HEIGHT, TILE - GAP);
  const meshes: THREE.Mesh[] = board.tiles.map((_, id) => {
    const mesh = new THREE.Mesh(
      tileGeo,
      new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    );
    mesh.position.copy(toWorld(coordOf(board, id), -TILE_HEIGHT / 2));
    group.add(mesh);
    return mesh;
  });

  const outline = (color: number, inner: number) => {
    const half = (TILE - GAP) / 2;
    const shape = new THREE.Shape()
      .moveTo(-half, -half)
      .lineTo(half, -half)
      .lineTo(half, half)
      .lineTo(-half, half);
    const h = inner / 2;
    shape.holes.push(
      new THREE.Path().moveTo(-h, -h).lineTo(-h, h).lineTo(h, h).lineTo(h, -h),
    );
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  };
  const hoverFrame = outline(0xffffff, TILE - GAP - 0.06);
  const selectedFrame = outline(ORDER_COLOR, TILE - GAP - 0.34);
  selectedFrame.position.y = 0.012;
  hoverFrame.position.y = 0.006;

  const optionMarks: THREE.Group[] = [];
  const discGeo = new THREE.CircleGeometry(0.2, 20);
  const ringGeo = new THREE.RingGeometry(0.3, 0.37, 24);
  const discMat = new THREE.MeshBasicMaterial({
    color: ORDER_COLOR,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  const ringMat = new THREE.MeshBasicMaterial({
    color: ORDER_COLOR,
    side: THREE.DoubleSide,
  });
  const makeOptionMark = () => {
    const g = new THREE.Group();
    for (const [geo, mat] of [
      [discGeo, discMat],
      [ringGeo, ringMat],
    ] as const) {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      g.add(m);
    }
    g.position.y = 0.01;
    group.add(g);
    return g;
  };

  let hover: Coord | null = null;
  let selected: Coord | null = null;
  let lastState = state;
  const pulses = new Float32Array(board.tiles.length);

  const colorTile = (id: number, s: BattleState) => {
    const c = coordOf(board, id);
    const base = (c.x + c.y) % 2 === 0 ? BASE_A : BASE_B;
    const t = Math.min(
      1,
      Math.max(
        0,
        (s.board.tiles[id]?.inflammation ?? 0) / PARAMS.maxInflammation,
      ),
    );
    const mat = meshes[id]!.material as THREE.MeshStandardMaterial;
    mat.color.copy(base).lerp(INFLAMED, t * 0.7);
    if (pulses[id]! > 0) mat.color.lerp(PULSE_TINT, pulses[id]! * 0.8);
    if (hover && sameCoord(hover, c)) mat.color.lerp(HOVER_TINT, 0.25);
  };

  const refreshAll = () => meshes.forEach((_, id) => colorTile(id, lastState));

  const place = (frame: THREE.Mesh, c: Coord | null) => {
    frame.visible = c !== null;
    if (c) {
      const p = toWorld(c);
      frame.position.x = p.x;
      frame.position.z = p.z;
    }
  };

  const raycaster = new THREE.Raycaster();

  refreshAll();

  return {
    group,
    update(s) {
      lastState = s;
      refreshAll();
    },
    pick(pointer, camera) {
      raycaster.setFromCamera(new THREE.Vector2(pointer.x, pointer.y), camera);
      const hit = raycaster.intersectObjects(meshes, false)[0];
      return hit
        ? coordOf(board, meshes.indexOf(hit.object as THREE.Mesh))
        : null;
    },
    setHover(coord) {
      const next = coord && inBounds(board, coord) ? coord : null;
      if (next === hover || (next && hover && sameCoord(next, hover))) return;
      const prev = hover;
      hover = next;
      if (prev) colorTile(tileId(board, prev), lastState);
      if (next) colorTile(tileId(board, next), lastState);
      place(hoverFrame, next);
    },
    setSelected(coord) {
      selected = coord && inBounds(board, coord) ? coord : null;
      place(selectedFrame, selected);
    },
    setOptions(coords) {
      while (optionMarks.length < coords.length) {
        optionMarks.push(makeOptionMark());
      }
      optionMarks.forEach((g, i) => {
        const c = coords[i];
        g.visible = c !== undefined;
        if (c) {
          const p = toWorld(c);
          g.position.set(p.x, 0.01, p.z);
        }
      });
    },
    setPulse(coord, amount) {
      if (!inBounds(board, coord)) return;
      const id = tileId(board, coord);
      if (pulses[id] === amount) return;
      pulses[id] = amount;
      colorTile(id, lastState);
    },
    clearPulses() {
      for (let id = 0; id < pulses.length; id++) {
        if (pulses[id] === 0) continue;
        pulses[id] = 0;
        colorTile(id, lastState);
      }
    },
    tilePosition: (c) => toWorld(c),
  };
}
