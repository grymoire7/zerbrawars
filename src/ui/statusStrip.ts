import type { PaletteName } from "../theme/palette";

// The pinned status strip (B1a design, section 2). A pure render from a StatusModel: every cell
// has a word label, a value and a state word, so colour is never the only signal. Tapping a cell
// writes its one-sentence explanation into the line under the strip; tapping again clears it.

/** A meter bar. A solid part up to `solid`, and a ghost part from `solid` up to `ghost`. */
export type StatusBar =
  | {
      readonly kind: "fill";
      /** Fractions of the whole, 0..1. */
      readonly solid: number;
      readonly ghost: number;
      /** A notch at this fraction (the tissue level where backup is called). */
      readonly notch?: number;
    }
  | {
      readonly kind: "segments";
      readonly count: number;
      /** Segment counts, 0..count. */
      readonly solid: number;
      readonly ghost: number;
    };

export interface StatusCell {
  readonly id: string;
  /** The word label, e.g. "Tissue". */
  readonly label: string;
  /** A shorter label for narrow phones (e.g. "Meds"); the full label stays in the accessible name. */
  readonly short?: string;
  /** The value text, e.g. "18/20". */
  readonly value: string;
  /** The state word, e.g. "healthy". Always in the accessible label. */
  readonly state: string;
  /**
   * Whether the state word is also printed in the cell. Left out (false) when the value and the bar
   * already say it, so a calm cell stays quiet; a cell that needs attention shows its word.
   */
  readonly showState?: boolean;
  readonly bar: StatusBar | null;
  readonly color: PaletteName;
  /** One plain sentence, shown when the cell is tapped and read as the accessible label. */
  readonly explain: string;
}

export interface StatusModel {
  readonly cells: readonly StatusCell[];
}

export interface StatusStrip {
  update(model: StatusModel): void;
  clear(): void;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** The full sentence a screen reader gets for a cell. */
export const cellLabel = (c: StatusCell): string =>
  `${c.label}: ${c.value}, ${c.state}. ${c.explain}`;

function buildBar(bar: StatusBar, color: PaletteName): HTMLElement {
  const track = document.createElement("div");
  track.className = `zw-bar zw-bar-${bar.kind}`;
  track.setAttribute("aria-hidden", "true");
  const tone = `var(--zw-${color})`;
  if (bar.kind === "fill") {
    const ghost = document.createElement("div");
    ghost.className = "zw-bar-ghost";
    ghost.style.cssText = `width:${clamp01(bar.ghost) * 100}%;background-color:${tone};`;
    const solid = document.createElement("div");
    solid.className = "zw-bar-solid";
    solid.style.cssText = `width:${clamp01(bar.solid) * 100}%;background-color:${tone};`;
    track.append(ghost, solid);
    if (bar.notch !== undefined) {
      const notch = document.createElement("div");
      notch.className = "zw-bar-notch";
      notch.style.left = `${clamp01(bar.notch) * 100}%`;
      track.append(notch);
    }
    return track;
  }
  for (let i = 0; i < bar.count; i++) {
    const seg = document.createElement("span");
    seg.className =
      i < bar.solid
        ? "zw-seg zw-seg-solid"
        : i < bar.ghost
          ? "zw-seg zw-seg-ghost"
          : "zw-seg";
    seg.style.setProperty("--zw-seg", tone);
    track.append(seg);
  }
  return track;
}

/** Fills a cell button from its model. Rebuilt in place so focus survives a redraw. */
function fillCell(btn: HTMLButtonElement, c: StatusCell, open: boolean): void {
  const label = document.createElement("span");
  label.className = "zw-cell-label";
  if (c.short) {
    const full = document.createElement("span");
    full.className = "zw-label-full";
    full.textContent = c.label;
    const short = document.createElement("span");
    short.className = "zw-label-short";
    short.textContent = c.short;
    label.append(full, short);
  } else label.textContent = c.label;
  const value = document.createElement("span");
  value.className = "zw-cell-value";
  value.append(c.value);
  if (c.showState !== false) {
    const state = document.createElement("span");
    state.className = "zw-cell-state";
    state.textContent = c.state;
    value.append(" ", state);
  }
  btn.replaceChildren(label, value);
  if (c.bar) btn.append(buildBar(c.bar, c.color));
  btn.setAttribute("aria-label", cellLabel(c));
  btn.setAttribute("aria-pressed", String(open));
}

/** Mounts the strip into `mount` (the #status element). Nothing here touches sim state. */
export function createStatusStrip(mount: HTMLElement): StatusStrip {
  const grid = document.createElement("div");
  grid.className = "zw-status-grid";
  const info = document.createElement("div");
  info.className = "zw-status-info";
  info.setAttribute("aria-live", "polite");
  info.hidden = true;
  mount.replaceChildren(grid, info);

  let model: StatusModel | null = null;
  let openId: string | null = null;
  let ids = "";
  const buttons = new Map<string, HTMLButtonElement>();

  const showInfo = () => {
    const c = model?.cells.find((x) => x.id === openId);
    info.hidden = !c;
    info.textContent = c ? c.explain : "";
  };

  const toggle = (id: string) => {
    openId = openId === id ? null : id;
    render();
  };

  function render() {
    if (!model) return;
    const next = model.cells.map((c) => c.id).join();
    if (next !== ids) {
      ids = next;
      buttons.clear();
      grid.replaceChildren();
      for (const c of model.cells) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "zw-cell";
        b.dataset.cell = c.id;
        b.addEventListener("click", () => toggle(c.id));
        buttons.set(c.id, b);
        grid.append(b);
      }
    }
    if (openId && !model.cells.some((c) => c.id === openId)) openId = null;
    grid.dataset.cols = String(model.cells.length);
    for (const c of model.cells) {
      const b = buttons.get(c.id);
      if (b) fillCell(b, c, c.id === openId);
    }
    showInfo();
  }

  return {
    update(m) {
      model = m;
      render();
    },
    clear() {
      model = null;
      ids = "";
      openId = null;
      buttons.clear();
      mount.replaceChildren();
    },
  };
}
