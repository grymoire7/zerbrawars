/**
 * Maths for starting a pill at Zoreo's mouth, which is a DOM element over the canvas. Plain
 * numbers only, so it tests in Node; the camera unprojection lives in the battle screen.
 */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Client-pixel point to normalised device coordinates within `rect` (the canvas), y up. */
export function clientToNdc(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: ((x - rect.left) / rect.width) * 2 - 1,
    y: 1 - ((y - rect.top) / rect.height) * 2,
  };
}

/**
 * Where the sight line from `origin` along `dir` meets the horizontal plane at height `y`, or null
 * when it points level or upward, or the plane is behind the origin.
 */
export function hitPlane(origin: Vec3, dir: Vec3, y: number): Vec3 | null {
  if (dir.y >= -1e-4) return null;
  const t = (y - origin.y) / dir.y;
  if (t <= 0) return null;
  return {
    x: origin.x + dir.x * t,
    y,
    z: origin.z + dir.z * t,
  };
}
