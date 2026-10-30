import * as THREE from "three";

const materials = new Map<string, THREE.SpriteMaterial>();
let boost = 1;

/** Small boards (phones) draw their world labels larger so the text stays readable. */
export function setLabelBoost(width: number, height: number): void {
  boost = Math.min(1.7, Math.max(1, 700 / Math.min(width, height * 1.35)));
}

export interface LabelOptions {
  readonly color?: string;
  readonly background?: string;
  /** A round badge (for a single number) instead of a pill. */
  readonly round?: boolean;
}

/** A shared sprite material for `text`; cached, so never dispose it. */
export function labelMaterial(
  text: string,
  {
    color = "#ffffff",
    background = "rgba(26,28,34,0.9)",
    round = false,
  }: LabelOptions = {},
): THREE.SpriteMaterial {
  const key = `${text}|${color}|${background}|${round}`;
  const hit = materials.get(key);
  if (hit) return hit;
  const font = "bold 40px sans-serif";
  const canvas = document.createElement("canvas");
  const g = canvas.getContext("2d");
  let aspect = 1;
  if (g) {
    g.font = font;
    const w = round ? 64 : Math.ceil(g.measureText(text).width) + 28;
    canvas.width = w;
    canvas.height = 64;
    aspect = w / 64;
    g.fillStyle = background;
    g.beginPath();
    g.roundRect(2, 2, w - 4, 60, round ? 30 : 16);
    g.fill();
    g.strokeStyle = color;
    g.globalAlpha = 0.7;
    g.lineWidth = 3;
    g.stroke();
    g.globalAlpha = 1;
    g.fillStyle = color;
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, w / 2, 34);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: false,
    transparent: true,
  });
  mat.userData.aspect = aspect;
  materials.set(key, mat);
  return mat;
}

/** Scales a sprite to `height` world units, keeping the label's aspect. */
export function sizeLabel(sprite: THREE.Sprite, height: number): void {
  const aspect = (sprite.material.userData.aspect as number | undefined) ?? 1;
  sprite.scale.set(height * boost * aspect, height * boost, 1);
}

export function labelSprite(
  text: string,
  height: number,
  opts?: LabelOptions,
): THREE.Sprite {
  const sprite = new THREE.Sprite(labelMaterial(text, opts));
  sizeLabel(sprite, height);
  sprite.renderOrder = 13;
  return sprite;
}
