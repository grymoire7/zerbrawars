import * as THREE from "three";
import { PALETTE } from "../theme/palette";

const SIZE = 768;
/** Half-width of the rounded base and its corner radius, in board units. */
const HALF = 3.75;
const CORNER = 1.1;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Side of the square plane that carries the base and its aura, in board units. */
export function basePlaneUnits(board: { width: number; height: number }) {
  return Math.max(board.width, board.height) + 1.6;
}

/**
 * Mint medication glow hugging the inside of the organic outline, on the same plane as the base.
 * Transparent everywhere else, so nothing square shows.
 */
export function createAuraTexture(planeUnits: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g = canvas.getContext("2d");
  if (g) {
    const px = SIZE / planeUnits;
    g.save();
    organicPath(g, px, mulberry32(20261121));
    g.clip();
    g.lineJoin = "round";
    g.strokeStyle = "rgba(120,240,205,0.9)";
    g.shadowColor = "rgba(120,240,205,0.9)";
    g.shadowBlur = px * 0.5;
    g.lineWidth = px * 0.2;
    organicPath(g, px, mulberry32(20261121));
    g.stroke();
    g.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Procedural flesh-toned base, drawn once from a fixed seed. It is a rounded, slightly wobbly
 * organic shape (no straight edges or sharp corners) on a transparent canvas that spans
 * `planeUnits` board units, with soft lighter and darker blobs, thin capillary curves and a darker
 * inner rim for depth. No image assets.
 */
export function createTissueTexture(planeUnits: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g = canvas.getContext("2d");
  if (g) paintTissue(g, SIZE / planeUnits);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Closed outline: a rounded square pushed in and out by a few smooth harmonics. */
function organicPath(
  g: CanvasRenderingContext2D,
  px: number,
  rand: () => number,
): void {
  const cx = SIZE / 2;
  const harmonics = [3, 5, 7].map((k) => ({
    k,
    amp: 0.1 / (k - 1),
    phase: rand() * Math.PI * 2,
  }));
  const N = 120;
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    // Rounded-square radius along direction a.
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const inner = HALF - CORNER;
    // Distance to the rounded square along (dx, dy): solve against the rounded-corner circle or the flat side.
    const m = Math.max(Math.abs(dx), Math.abs(dy));
    const flat = HALF / m;
    const px0 = Math.abs(dx) * flat;
    const py0 = Math.abs(dy) * flat;
    let r = flat;
    if (px0 > inner && py0 > inner) {
      const b = Math.abs(dx) * inner + Math.abs(dy) * inner;
      r = b + Math.sqrt(b * b - 2 * inner * inner + CORNER * CORNER);
    }
    for (const h of harmonics) r += h.amp * Math.sin(h.k * a + h.phase);
    const x = cx + dx * r * px;
    const y = cx + dy * r * px;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

function paintTissue(g: CanvasRenderingContext2D, px: number): void {
  const rand = mulberry32(20261121);
  g.save();
  organicPath(g, px, rand);
  g.fillStyle = PALETTE["region-lung-bg"];
  g.fill();
  g.clip();

  for (let i = 0; i < 46; i++) {
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const r = 30 + rand() * 60;
    const light = i % 2 === 0;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(
      0,
      light ? "rgba(255,226,208,0.40)" : "rgba(150,70,70,0.22)",
    );
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  g.lineCap = "round";
  g.strokeStyle = "rgba(170,70,80,0.28)";
  for (let i = 0; i < 14; i++) {
    g.lineWidth = 1 + rand() * 1.8;
    g.beginPath();
    let x = rand() * SIZE;
    let y = rand() * SIZE;
    g.moveTo(x, y);
    const a = rand() * Math.PI * 2;
    for (let s = 0; s < 3; s++) {
      const cx = x + Math.cos(a + s) * (50 + rand() * 40);
      const cy = y + Math.sin(a + s) * (50 + rand() * 40);
      x = cx + Math.cos(a) * 40;
      y = cy + Math.sin(a) * 40;
      g.quadraticCurveTo(cx, cy, x, y);
    }
    g.stroke();
  }
  g.restore();

  // Darker inner rim: stroke the same outline, clipped to inside.
  g.save();
  const rimRand = mulberry32(20261121);
  organicPath(g, px, rimRand);
  g.clip();
  g.lineJoin = "round";
  g.strokeStyle = "rgba(150,70,70,0.30)";
  g.lineWidth = 28;
  organicPath(g, px, mulberry32(20261121));
  g.stroke();
  g.restore();
}
