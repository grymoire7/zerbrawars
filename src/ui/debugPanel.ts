import { SCENARIO_NAMES } from "../sim/scenarios";

export interface DebugPanelOptions {
  readonly scenario: string;
  readonly seed: number;
  /** Skip turn playback (starts from prefers-reduced-motion). */
  readonly skipPlayback: boolean;
  onSkipPlayback(on: boolean): void;
}

export interface DebugPanel {
  readonly element: HTMLElement;
  /** Frame stats line, e.g. "60 fps  16.6 ms (max 18.0)". */
  setStats(text: string): void;
}

/** Small collapsible panel. Changing scenario or seed reloads with matching URL parameters. */
export function createDebugPanel(
  root: HTMLElement,
  opts: DebugPanelOptions,
): DebugPanel {
  const panel = document.createElement("div");
  panel.style.cssText =
    "font:14px sans-serif;color:#c8ccd4;background:#262a33;border:1px solid #3a3f4a;border-radius:6px;" +
    "padding:4px;display:flex;flex-direction:column;gap:6px;align-items:stretch;";

  const toggle = document.createElement("button");
  toggle.type = "button";
  const body = document.createElement("div");
  body.style.cssText = "display:flex;flex-direction:column;gap:6px;";

  const control =
    "min-height:44px;font:inherit;box-sizing:border-box;padding:0 8px;";
  const label = (text: string, el: HTMLElement) => {
    const l = document.createElement("label");
    l.style.cssText =
      "display:flex;flex-direction:column;gap:2px;font-size:12px;";
    l.append(text, el);
    return l;
  };

  const select = document.createElement("select");
  select.style.cssText = control;
  for (const name of SCENARIO_NAMES) {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name;
    select.appendChild(o);
  }
  select.value = opts.scenario;

  const seed = document.createElement("input");
  seed.type = "number";
  seed.step = "1";
  seed.value = String(opts.seed);
  seed.style.cssText = control + "width:8em;";

  const apply = () => {
    const n = Number(seed.value);
    if (seed.value.trim() === "" || !Number.isFinite(n)) return;
    const url = new URL(window.location.href);
    url.searchParams.set("scenario", select.value);
    url.searchParams.set("seed", String(n));
    window.location.assign(url);
  };
  select.addEventListener("change", apply);
  seed.addEventListener("change", apply);

  const skip = document.createElement("input");
  skip.type = "checkbox";
  skip.checked = opts.skipPlayback;
  skip.style.cssText = "width:20px;height:20px;margin:0;";
  skip.addEventListener("change", () => opts.onSkipPlayback(skip.checked));
  const skipRow = document.createElement("label");
  skipRow.style.cssText =
    "display:flex;align-items:center;gap:8px;min-height:44px;font-size:12px;";
  skipRow.append(skip, "Skip playback (reduced motion)");

  const stats = document.createElement("div");
  stats.style.cssText = "font:11px monospace;opacity:0.8;padding:0 4px;";

  body.append(label("Scenario", select), label("Seed", seed), skipRow);

  let open = false;
  const sync = () => {
    body.style.display = open ? "flex" : "none";
    toggle.textContent = open ? "Debug ▴" : "Debug ▾";
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.style.cssText = control + "opacity:0.8;";
  toggle.addEventListener("click", () => {
    open = !open;
    sync();
  });
  sync();

  panel.append(toggle, stats, body);
  root.appendChild(panel);
  return {
    element: panel,
    setStats(text) {
      stats.textContent = text;
    },
  };
}
