import { SCENARIO_NAMES } from "../sim/scenarios";

export interface DebugPanelOptions {
  readonly scenario: string;
  readonly seed: number;
}

/** Small collapsible panel. Changing scenario or seed reloads with matching URL parameters. */
export function createDebugPanel(
  root: HTMLElement,
  opts: DebugPanelOptions,
): HTMLElement {
  const panel = document.createElement("div");
  panel.style.cssText =
    "position:absolute;right:8px;top:8px;pointer-events:auto;font:14px sans-serif;" +
    "color:#c8ccd4;background:rgba(26,28,34,0.85);border:1px solid #3a3f4a;border-radius:6px;" +
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

  body.append(label("Scenario", select), label("Seed", seed));

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

  panel.append(toggle, body);
  root.appendChild(panel);
  return panel;
}
