/** Player-facing copy for a browser that cannot run the game's graphics. */
export const NO_WEBGL = {
  title: "Zebra Wars needs graphics acceleration",
  body: "Your browser could not start the graphics the game uses (WebGL). Please check that “use graphics acceleration” is turned on in your browser’s settings, or try another browser.",
  reload: "Reload",
} as const;

/** True when `makeContext` yields a WebGL context for any of the kinds the renderer accepts. */
export function webglAvailable(
  makeContext: (kind: "webgl2" | "webgl") => unknown,
): boolean {
  for (const kind of ["webgl2", "webgl"] as const) {
    try {
      if (makeContext(kind)) return true;
    } catch {
      // A throwing probe counts as "not here"; try the next kind.
    }
  }
  return false;
}
