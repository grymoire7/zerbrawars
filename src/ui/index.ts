/** DOM overlay. Placeholder; HUD and panels arrive in later tasks. */
export function getUiRoot(): HTMLElement {
  const el = document.getElementById("ui");
  if (!el) throw new Error("#ui element missing");
  return el;
}
