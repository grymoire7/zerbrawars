import * as THREE from "three";

/**
 * Immediate-mode effects for playback: call reset(), draw this frame's rings, sparks, blobs and
 * labels, then commit(). Everything comes from fixed pools, so a frame allocates nothing and a
 * busy turn drops effects instead of growing.
 */
export interface FxView {
  reset(): void;
  /** Flat ring on the ground plane at (x, y, z). */
  ring(
    x: number,
    y: number,
    z: number,
    radius: number,
    opacity: number,
    color: number,
  ): void;
  /**
   * `count` sparks flung from (x, y, z), `p` 0..1 through their flight. `seed` keeps each burst's
   * directions stable from frame to frame.
   */
  burst(
    seed: number,
    x: number,
    y: number,
    z: number,
    p: number,
    count: number,
    speed: number,
    color: number,
  ): void;
  /** A small sphere: a spore, a bud or a bounced projectile. */
  blob(
    x: number,
    y: number,
    z: number,
    scale: number,
    color: number,
    opacity: number,
  ): void;
  /** Floating text; `scale` 1 = normal size. */
  label(
    text: string,
    color: string,
    x: number,
    y: number,
    z: number,
    opacity: number,
    scale: number,
  ): void;
  commit(): void;
}

const RINGS = 12;
const SPARKS = 128;
const BLOBS = 16;
const LABELS = 8;
const GRAVITY = 2.2;

function rand(seed: number, i: number): number {
  let t = (seed * 374761393 + i * 668265263) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}

export function createFxView(scene: THREE.Scene): FxView {
  const group = new THREE.Group();
  group.renderOrder = 20;
  scene.add(group);

  const ringGeo = new THREE.RingGeometry(0.82, 1, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: RINGS }, () => {
    const m = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    m.renderOrder = 20;
    m.visible = false;
    group.add(m);
    return m;
  });

  const sparkMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const sparks = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(1, 0),
    sparkMat,
    SPARKS,
  );
  sparks.frustumCulled = false;
  sparks.count = 0;
  sparks.renderOrder = 21;
  // Allocate the color buffer up front.
  sparks.setColorAt(0, new THREE.Color());
  group.add(sparks);

  const blobGeo = new THREE.SphereGeometry(1, 12, 8);
  const blobs = Array.from({ length: BLOBS }, () => {
    const m = new THREE.Mesh(
      blobGeo,
      new THREE.MeshStandardMaterial({ roughness: 0.5, transparent: true }),
    );
    m.visible = false;
    group.add(m);
    return m;
  });

  const textures = new Map<string, THREE.CanvasTexture>();
  const texture = (text: string, color: string) => {
    const key = `${color}|${text}`;
    let tex = textures.get(key);
    if (tex) return tex;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const g = canvas.getContext("2d");
    if (g) {
      // Long text shrinks to fit the texture.
      g.font = "bold 34px sans-serif";
      const fit = Math.min(1, 236 / g.measureText(text).width);
      g.font = `bold ${Math.floor(34 * fit)}px sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineWidth = 7;
      g.strokeStyle = "rgba(20,22,28,0.9)";
      g.strokeText(text, 128, 34);
      g.fillStyle = color;
      g.fillText(text, 128, 34);
    }
    tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    textures.set(key, tex);
    return tex;
  };
  const labels = Array.from({ length: LABELS }, () => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ depthTest: false, transparent: true }),
    );
    s.renderOrder = 30;
    s.visible = false;
    group.add(s);
    return s;
  });

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  let nRing = 0;
  let nSpark = 0;
  let nBlob = 0;
  let nLabel = 0;

  return {
    reset() {
      nRing = nSpark = nBlob = nLabel = 0;
    },
    ring(x, y, z, radius, opacity, color) {
      if (nRing >= RINGS || opacity <= 0.01 || radius <= 0) return;
      const m = rings[nRing++]!;
      m.visible = true;
      m.position.set(x, y, z);
      m.scale.setScalar(radius);
      const mat = m.material;
      mat.color.setHex(color);
      mat.opacity = opacity;
    },
    burst(seed, x, y, z, p, count, speed, color) {
      if (p <= 0 || p >= 1) return;
      tmpColor.setHex(color);
      const size = 0.05 * (1 - p);
      for (let i = 0; i < count && nSpark < SPARKS; i++) {
        const a = rand(seed, i * 3) * Math.PI * 2;
        const up = 0.4 + rand(seed, i * 3 + 1) * 0.9;
        const v = speed * (0.5 + rand(seed, i * 3 + 2) * 0.7);
        dummy.position.set(
          x + Math.cos(a) * v * p,
          y + up * v * p - GRAVITY * p * p * 0.5,
          z + Math.sin(a) * v * p,
        );
        dummy.rotation.set(a, a * 2, 0);
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        sparks.setMatrixAt(nSpark, dummy.matrix);
        sparks.setColorAt(nSpark, tmpColor);
        nSpark++;
      }
    },
    blob(x, y, z, scale, color, opacity) {
      if (nBlob >= BLOBS || scale <= 0.001 || opacity <= 0.01) return;
      const m = blobs[nBlob++]!;
      m.visible = true;
      m.position.set(x, y, z);
      m.scale.setScalar(scale);
      m.material.color.setHex(color);
      m.material.opacity = opacity;
    },
    label(text, color, x, y, z, opacity, scale) {
      if (nLabel >= LABELS || opacity <= 0.01) return;
      const s = labels[nLabel++]!;
      s.visible = true;
      s.position.set(x, y, z);
      s.scale.set(1.3 * scale, 0.325 * scale, 1);
      const mat = s.material;
      if (s.userData.text !== text || s.userData.color !== color) {
        s.userData.text = text;
        s.userData.color = color;
        mat.map = texture(text, color);
        mat.needsUpdate = true;
      }
      mat.opacity = opacity;
    },
    commit() {
      for (let i = nRing; i < RINGS; i++) rings[i]!.visible = false;
      for (let i = nBlob; i < BLOBS; i++) blobs[i]!.visible = false;
      for (let i = nLabel; i < LABELS; i++) labels[i]!.visible = false;
      sparks.count = nSpark;
      if (nSpark > 0) {
        sparks.instanceMatrix.needsUpdate = true;
        if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;
      }
    },
  };
}
