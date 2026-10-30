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
const SLAB = 0x3a2f31;

export interface BoardView {
  readonly group: THREE.Group;
  /** Recolors tiles from state. Reads only; never mutates it. */
  update(state: BattleState): void;
  /** `pointer` is in normalized device coords (-1..1, y up). */
  pick(pointer: { x: number; y: number }, camera: THREE.Camera): Coord | null;
  setHover(coord: Coord | null): void;
  setSelected(coord: Coord | null): void;
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
  const selectedFrame = outline(0xffd23f, TILE - GAP - 0.16);
  selectedFrame.position.y = 0.012;
  hoverFrame.position.y = 0.006;

  let hover: Coord | null = null;
  let selected: Coord | null = null;
  let lastState = state;

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
    tilePosition: (c) => toWorld(c),
  };
}
