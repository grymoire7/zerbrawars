import * as THREE from "three";
import { PALETTE } from "../theme/palette";

const SIZE = 512;

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

/**
 * Procedural lung-tissue background, drawn once from a fixed seed: region-lung-bg fill, soft
 * lighter and darker blobs, thin capillary curves and an alpha vignette so the edges fade into the
 * scene background. No image assets.
 */
export function createTissueTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g = canvas.getContext("2d");
  if (g) paintTissue(g);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function paintTissue(g: CanvasRenderingContext2D): void {
  const rand = mulberry32(20261121);
  g.fillStyle = PALETTE["region-lung-bg"];
  g.fillRect(0, 0, SIZE, SIZE);

  for (let i = 0; i < 40; i++) {
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const r = 30 + rand() * 50;
    const light = i % 2 === 0;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(
      0,
      light ? `${PALETTE["region-lung"]}99` : "rgba(20,8,12,0.28)",
    );
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  g.lineCap = "round";
  g.strokeStyle = "rgba(24,10,14,0.45)";
  for (let i = 0; i < 12; i++) {
    g.lineWidth = 1 + rand() * 1.6;
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

  // Alpha vignette: opaque in the middle, transparent at the edges.
  g.globalCompositeOperation = "destination-in";
  const half = SIZE / 2;
  const fade = g.createRadialGradient(half, half, SIZE * 0.3, half, half, half);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = fade;
  g.fillRect(0, 0, SIZE, SIZE);
  g.globalCompositeOperation = "source-over";
}
