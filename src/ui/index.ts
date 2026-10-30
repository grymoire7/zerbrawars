const need = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} element missing`);
  return el;
};

/** Full-window overlay for modals (outcome, how to play); it never holds board panels. */
export function getUiRoot(): HTMLElement {
  return need("ui");
}

/** The side panel regions: a scrollable column and a pinned control bar. */
export function getPanels(): { scroll: HTMLElement; bar: HTMLElement } {
  return { scroll: need("sideScroll"), bar: need("bar") };
}
