import * as THREE from "three";
import { coordOf, inBounds, sameCoord, tileId } from "../sim/board";
import { PARAMS } from "../sim/params";
import type { TileHeat } from "../sim/battle/inflammation";
import type { BattleState, Coord } from "../sim/types";
import { PALETTE, hex } from "../theme/palette";

const TILE = 1;
const GAP = 0.06;
const TILE_HEIGHT = 0.2;

const BASE_A = new THREE.Color(hex("region-lung"));
const BASE_B = new THREE.Color(hex("region-lung")).multiplyScalar(0.96);
const INFLAMED = new THREE.Color(hex("tissue-damaged"));
const HOVER_TINT = new THREE.Color(hex("white"));
const PULSE_TINT = new THREE.Color(hex("heat"));
const SLAB = hex("region-lung-bg");
// Order UI: magenta-violet, apart from the telegraph's yellow/blue/red/white. Shape carries it too:
// a thick solid frame for the selection, filled discs with a ring for destinations.
export const ORDER_COLOR = hex("order");

/**
 * Inflammation is tint plus a pattern, so it reads without color: 1 dots, 2 diagonal hatch,
 * 3 cross-hatch. Dark lines keep contrast against the warm tint at every level.
 */
function heatTexture(level: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    g.fillStyle = PALETTE["heat-ink"];
    g.strokeStyle = PALETTE["heat-ink"];
    g.lineWidth = level === 3 ? 6 : 7;
    if (level === 1) {
      for (let y = 20; y < size; y += 44) {
        for (let x = 20 + ((y / 44) % 2) * 22; x < size; x += 44) {
          g.beginPath();
          g.arc(x, y, 8, 0, Math.PI * 2);
          g.fill();
        }
      }
    } else {
      const step = level === 2 ? 36 : 26;
      g.beginPath();
      for (let k = -size; k < size * 2; k += step) {
        g.moveTo(k, 0);
        g.lineTo(k + size, size);
        if (level === 3) {
          g.moveTo(k + size, 0);
          g.lineTo(k, size);
        }
      }
      g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Warm corner glow with one or two small flame glyphs, so the cue is a shape and not just color. */
function chipTexture(flames: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const glow = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    glow.addColorStop(0, "rgba(255,150,40,0.95)");
    glow.addColorStop(0.55, "rgba(255,110,20,0.55)");
    glow.addColorStop(1, "rgba(255,90,10,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, size, size);
    g.fillStyle = PALETTE.kill;
    const flame = (cx: number) => {
      g.beginPath();
      g.moveTo(cx, 30);
      g.bezierCurveTo(cx + 6, 46, cx + 16, 52, cx + 14, 70);
      g.bezierCurveTo(cx + 12, 84, cx - 12, 84, cx - 14, 70);
      g.bezierCurveTo(cx - 16, 58, cx - 6, 52, cx, 30);
      g.fill();
    };
    if (flames === 1) flame(64);
    else {
      flame(46);
      flame(82);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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
  /** Warm flame glows in a tile corner on tiles that will heat up if the turn ends now (empty clears them). */
  setForecast(rising: readonly TileHeat[]): void;
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

  // One flat pattern plane per tile, swapped by level (maxInflammation is 3).
  const heatMats = [1, 2, 3].map(
    (level) =>
      new THREE.MeshBasicMaterial({
        map: heatTexture(level),
        transparent: true,
        opacity: 0.5 + 0.1 * level,
        depthWrite: false,
      }),
  );
  const heatGeo = new THREE.PlaneGeometry(TILE - GAP - 0.04, TILE - GAP - 0.04);
  heatGeo.rotateX(-Math.PI / 2);
  const heat: THREE.Mesh[] = meshes.map((m) => {
    const h = new THREE.Mesh(heatGeo, heatMats[0]);
    h.position.set(m.position.x, 0.004, m.position.z);
    h.visible = false;
    group.add(h);
    return h;
  });

  const chips: THREE.Mesh[] = [];
  const chipGeo = new THREE.PlaneGeometry(0.5, 0.5);
  chipGeo.rotateX(-Math.PI / 2);
  const chipMats = [1, 2].map(
    (flames) =>
      new THREE.MeshBasicMaterial({
        map: chipTexture(flames),
        transparent: true,
        depthWrite: false,
      }),
  );
  // A flat decal on the tile surface, drawn before everything else transparent so it never covers
  // tokens, swarms or fx.
  const makeChip = () => {
    const m = new THREE.Mesh(chipGeo, chipMats[0]);
    m.renderOrder = -1;
    group.add(m);
    return m;
  };

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
  const hoverFrame = outline(hex("white"), TILE - GAP - 0.06);
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
    const level = Math.round(s.board.tiles[id]?.inflammation ?? 0);
    const h = heat[id]!;
    h.visible = level > 0;
    if (level > 0) {
      h.material = heatMats[Math.min(level, heatMats.length) - 1]!;
    }
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
    setForecast(rising) {
      while (chips.length < rising.length) chips.push(makeChip());
      chips.forEach((m, i) => {
        const r = rising[i];
        m.visible = r !== undefined;
        if (!r) return;
        const p = toWorld(r.at);
        m.position.set(p.x + 0.2, 0.009, p.z + 0.2);
        // Two flames when it climbs two levels or more.
        m.material = chipMats[r.after - r.before >= 2 ? 1 : 0]!;
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
