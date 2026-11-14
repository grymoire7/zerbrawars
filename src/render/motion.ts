const query =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : null;
const still =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("still") === "1";

/** Read every frame, so a change of the OS setting takes effect at once. */
export const calm = (): boolean => still || (query?.matches ?? false);
