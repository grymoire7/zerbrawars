import * as THREE from "three";
import { coordOf, inBounds, sameCoord, tileId } from "../sim/board";
import { PARAMS } from "../sim/params";
import type { TileHeat } from "../sim/battle/inflammation";
import type { BattleState, Coord } from "../sim/types";
import { PALETTE, hex } from "../theme/palette";
import { cellHash, cellOutline, type Point2 } from "./cellShape";
import { basePlaneUnits, createTissueTexture } from "./tissueTexture";

const TILE = 1;
const CELL_DEPTH = 0.16;
const BEVEL_T = 0.04;
const BEVEL_S = 0.03;
// The cell's top face sits at y = 0; the tissue plane lies under the gaps.
const TISSUE_Y = -0.2;
const BREATH = 0.012;
const BREATH_SECONDS = 4.5;

const HEALTHY = new THREE.Color(hex("tissue-healthy"));
const STRESSED = new THREE.Color(hex("tissue-stressed"));
const DAMAGED = new THREE.Color(hex("tissue-damaged"));
// Healthy cells are glossy; shine fades as heat rises (roughness up, clearcoat down).
const GLOSS = { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 };
const MATTE = { roughness: 0.85, clearcoat: 0, clearcoatRoughness: 0.6 };
const HOVER_TINT = new THREE.Color(hex("white"));
const PULSE_TINT = new THREE.Color(hex("heat"));
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

/** Shared by every cell: a soft radial gradient (centre a little darker, like an alveolus) and faint speckles. */
function cellTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgb(235,235,235)");
    grad.addColorStop(1, "rgb(255,255,255)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    let a = 12345;
    const rand = () => {
      a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
      return a / 4294967296;
    };
    for (let i = 0; i < 28; i++) {
      g.fillStyle = i % 2 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
      g.beginPath();
      g.arc(rand() * size, rand() * size, 3 + rand() * 6, 0, Math.PI * 2);
      g.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  // Top-face UVs are the outline's own x, y (about -0.5..0.5), so centre the texture on the cell.
  tex.offset.set(0.5, 0.5);
  return tex;
}

/** The outline as a three Shape. Shape y is flipped so that after rotateX(-PI/2) world z equals outline y. */
function toShape(pts: readonly Point2[], scale = 1): THREE.Shape {
  const shape = new THREE.Shape();
  pts.forEach((p, i) => {
    if (i === 0) shape.moveTo(p.x * scale, -p.y * scale);
    else shape.lineTo(p.x * scale, -p.y * scale);
  });
  shape.closePath();
  return shape;
}

/** Cell-shaped ring: the outline minus the outline scaled by `hole`. */
function ringGeometry(pts: readonly Point2[], hole: number) {
  const shape = toShape(pts, 1.02);
  shape.holes.push(new THREE.Path(toShape(pts, hole).getPoints()));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
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
  /** Advances the slight cell breathing. A no-op under reduced motion or `?still=1`. */
  tick(dtSeconds: number): void;
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

  const outlines = board.tiles.map((_, id) => {
    const c = coordOf(board, id);
    return cellOutline(c.x, c.y);
  });

  // Tissue between and under the cells, fading out at its edges.
  const tissue = new THREE.Mesh(
    new THREE.PlaneGeometry(basePlaneUnits(board), basePlaneUnits(board)),
    new THREE.MeshStandardMaterial({
      map: createTissueTexture(basePlaneUnits(board)),
      transparent: true,
      roughness: 1,
    }),
  );
  tissue.rotation.x = -Math.PI / 2;
  tissue.position.y = TISSUE_Y;
  group.add(tissue);

  const surface = cellTexture();
  const meshes: THREE.Mesh[] = board.tiles.map((_, id) => {
    const geo = new THREE.ExtrudeGeometry(toShape(outlines[id]!), {
      depth: CELL_DEPTH,
      bevelEnabled: true,
      bevelThickness: BEVEL_T,
      bevelSize: BEVEL_S,
      bevelSegments: 2,
      curveSegments: 1,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -(CELL_DEPTH + BEVEL_T), 0);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshPhysicalMaterial({
        ...GLOSS,
        map: surface,
        specularIntensity: 0.6,
      }),
    );
    mesh.position.copy(toWorld(coordOf(board, id)));
    group.add(mesh);
    return mesh;
  });

  // Invisible full-size squares: a tap in the gap between cells still lands on the logical tile.
  const pickGeo = new THREE.PlaneGeometry(TILE, TILE);
  pickGeo.rotateX(-Math.PI / 2);
  const pickMat = new THREE.MeshBasicMaterial();
  pickMat.visible = false;
  const picks: THREE.Mesh[] = board.tiles.map((_, id) => {
    const m = new THREE.Mesh(pickGeo, pickMat);
    m.position.copy(toWorld(coordOf(board, id)));
    group.add(m);
    return m;
  });

  // Per-tile shade (up to 4%) and breathing phase, from the same hash as the shape.
  const bases = board.tiles.map((_, id) => {
    const c = coordOf(board, id);
    return new THREE.Color(1, 1, 1).multiplyScalar(
      1 + (cellHash(c.x, c.y, 1) - 0.5) * 0.08,
    );
  });
  const phases = Float32Array.from(board.tiles, (_, id) => {
    const c = coordOf(board, id);
    return cellHash(c.x, c.y, 2) * Math.PI * 2;
  });

  // One flat pattern mesh per tile, swapped by level (maxInflammation is 3). Clipped to the cell.
  const heatMats = [1, 2, 3].map(
    (level) =>
      new THREE.MeshBasicMaterial({
        map: heatTexture(level),
        transparent: true,
        opacity: 0.5 + 0.1 * level,
        depthWrite: false,
      }),
  );
  const heat: THREE.Mesh[] = meshes.map((m, id) => {
    const geo = new THREE.ShapeGeometry(toShape(outlines[id]!, 0.9));
    const pos = geo.getAttribute("position");
    const uv = geo.getAttribute("uv");
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, pos.getX(i) + 0.5, pos.getY(i) + 0.5);
    }
    geo.rotateX(-Math.PI / 2);
    const h = new THREE.Mesh(geo, heatMats[0]);
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

  // Cell-shaped rings, precomputed for every tile; the two frames just swap geometry.
  const hoverRings = outlines.map((o) => ringGeometry(o, 0.9));
  const selectedRings = outlines.map((o) => ringGeometry(o, 0.7));
  const makeFrame = (color: number, y: number) => {
    const mesh = new THREE.Mesh(
      hoverRings[0],
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
    );
    mesh.position.y = y;
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  };
  const hoverFrame = makeFrame(hex("white"), 0.006);
  const selectedFrame = makeFrame(ORDER_COLOR, 0.012);

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
    const base = bases[id]!;
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
    const mat = meshes[id]!.material as THREE.MeshPhysicalMaterial;
    // Pink to coral at level 1, then on to red at level 3.
    if (t < 1 / 3) mat.color.copy(HEALTHY).lerp(STRESSED, t * 3);
    else mat.color.copy(STRESSED).lerp(DAMAGED, (t - 1 / 3) * 1.5);
    mat.color.multiply(base);
    mat.roughness = GLOSS.roughness + (MATTE.roughness - GLOSS.roughness) * t;
    mat.clearcoat = GLOSS.clearcoat * (1 - t);
    mat.clearcoatRoughness =
      GLOSS.clearcoatRoughness +
      (MATTE.clearcoatRoughness - GLOSS.clearcoatRoughness) * t;
    if (pulses[id]! > 0) mat.color.lerp(PULSE_TINT, pulses[id]! * 0.8);
    if (hover && sameCoord(hover, c)) mat.color.lerp(HOVER_TINT, 0.25);
  };

  const refreshAll = () => meshes.forEach((_, id) => colorTile(id, lastState));

  const place = (
    frame: THREE.Mesh,
    c: Coord | null,
    rings: readonly THREE.BufferGeometry[],
  ) => {
    frame.visible = c !== null;
    if (c) {
      const p = toWorld(c);
      frame.position.x = p.x;
      frame.position.z = p.z;
      frame.geometry = rings[tileId(board, c)]!;
    }
  };

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const calm =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  const still =
    new URLSearchParams(window.location.search).get("still") === "1";
  let clock = 0;
  let breathing = false;

  refreshAll();

  return {
    group,
    update(s) {
      lastState = s;
      refreshAll();
    },
    pick(pointer, camera) {
      ndc.set(pointer.x, pointer.y);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(picks, false)[0];
      return hit
        ? coordOf(board, picks.indexOf(hit.object as THREE.Mesh))
        : null;
    },
    setHover(coord) {
      const next = coord && inBounds(board, coord) ? coord : null;
      if (next === hover || (next && hover && sameCoord(next, hover))) return;
      const prev = hover;
      hover = next;
      if (prev) colorTile(tileId(board, prev), lastState);
      if (next) colorTile(tileId(board, next), lastState);
      place(hoverFrame, next, hoverRings);
    },
    setSelected(coord) {
      selected = coord && inBounds(board, coord) ? coord : null;
      place(selectedFrame, selected, selectedRings);
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
    tick(dt) {
      if (still || calm?.matches) {
        if (breathing) {
          for (const m of meshes) m.scale.set(1, 1, 1);
          breathing = false;
        }
        return;
      }
      breathing = true;
      clock += dt;
      const w = (clock / BREATH_SECONDS) * Math.PI * 2;
      for (let i = 0; i < meshes.length; i++) {
        const k = 1 + BREATH * (0.5 + 0.5 * Math.sin(w + phases[i]!));
        meshes[i]!.scale.set(k, 1, k);
      }
    },
  };
}
