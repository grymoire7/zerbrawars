import { SCENARIO_NAMES } from "../sim/scenarios";
import { copyText, downloadText } from "./download";

/** The loadout levers (see app/loadoutOptions). */
export interface DebugLoadout {
  /** 0..1. */
  readonly med: number;
  readonly doctor: boolean;
  /** 0..1. */
  readonly residual: number;
}

export type DebugMode = "campaign" | "battle" | "life";

/** Facilitator switches and the session-log export (campaign runs only). */
export interface SessionDebug {
  readonly brought: boolean;
  readonly probe: boolean;
  onBrought(on: boolean): void;
  onProbe(on: boolean): void;
  exportJson(): string;
  readonly fileName: string;
}

export interface DebugPanelOptions {
  /** Which screen this panel sits on; "life" hides the battle-only levers. */
  readonly mode?: DebugMode;
  /** Switches screens (the campaign loop will do this itself later). */
  onMode?(mode: DebugMode): void;
  readonly scenario: string;
  readonly seed: number;
  /** Skip turn playback (starts from prefers-reduced-motion). */
  readonly skipPlayback?: boolean;
  onSkipPlayback?(on: boolean): void;
  readonly loadout?: DebugLoadout;
  readonly session?: SessionDebug;
  /** Restart the battle with these levers (the caller also updates the URL). */
  onRestart?(loadout: DebugLoadout): void;
}

export interface DebugPanel {
  readonly element: HTMLElement;
  /** Frame stats line, e.g. "60 fps  16.6 ms (max 18.0)". */
  setStats(text: string): void;
  /** Keeps the seed field in step when the seed changes elsewhere (New seed). */
  setSeed(seed: number): void;
}

/** Small collapsible panel. Changing scenario or seed reloads with matching URL parameters. */
export function createDebugPanel(
  root: HTMLElement,
  opts: DebugPanelOptions,
): DebugPanel {
  const panel = document.createElement("div");
  panel.style.cssText =
    "font:14px sans-serif;color:var(--zw-text-muted);background:var(--zw-raised);border:1px solid var(--zw-line);border-radius:6px;" +
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

  const mode = opts.mode ?? "battle";
  const modeSelect = document.createElement("select");
  modeSelect.style.cssText = control;
  for (const m of ["campaign", "life", "battle"] as const) {
    const o = document.createElement("option");
    o.value = m;
    o.textContent =
      m === "campaign"
        ? "Campaign"
        : m === "life"
          ? "Life phase only (calendar)"
          : "Battle only";
    modeSelect.appendChild(o);
  }
  modeSelect.value = mode;
  modeSelect.addEventListener("change", () =>
    opts.onMode?.(modeSelect.value as DebugMode),
  );

  const apply = () => {
    const n = Number(seed.value);
    if (seed.value.trim() === "" || !Number.isFinite(n)) return;
    const url = new URL(window.location.href);
    if (mode === "battle") url.searchParams.set("scenario", select.value);
    url.searchParams.set("seed", String(n));
    window.location.assign(url);
  };
  select.addEventListener("change", apply);
  seed.addEventListener("change", apply);

  const skip = document.createElement("input");
  skip.type = "checkbox";
  skip.checked = opts.skipPlayback ?? false;
  skip.style.cssText = "width:20px;height:20px;margin:0;";
  skip.addEventListener("change", () => opts.onSkipPlayback?.(skip.checked));
  const skipRow = document.createElement("label");
  skipRow.style.cssText =
    "display:flex;align-items:center;gap:8px;min-height:44px;font-size:12px;";
  skipRow.append(skip, "Skip playback (reduced motion)");

  const slider = (value: number) => {
    const r = document.createElement("input");
    r.type = "range";
    r.min = "0";
    r.max = "100";
    r.step = "1";
    r.value = String(Math.round(value * 100));
    r.style.cssText = "min-height:44px;width:100%;margin:0;";
    return r;
  };
  const sliderRow = (text: string, r: HTMLInputElement) => {
    const out = document.createElement("span");
    const show = () => (out.textContent = `${r.value}%`);
    show();
    r.addEventListener("input", show);
    const l = document.createElement("label");
    l.style.cssText =
      "display:flex;flex-direction:column;gap:2px;font-size:12px;";
    const head = document.createElement("span");
    head.style.cssText = "display:flex;justify-content:space-between;";
    head.append(text, out);
    l.append(head, r);
    return l;
  };
  const med = slider(opts.loadout?.med ?? 1);
  const residual = slider(opts.loadout?.residual ?? 0);
  const doctor = document.createElement("input");
  doctor.type = "checkbox";
  doctor.checked = opts.loadout?.doctor ?? false;
  doctor.style.cssText = "width:20px;height:20px;margin:0;";
  const doctorRow = document.createElement("label");
  doctorRow.style.cssText =
    "display:flex;align-items:center;gap:8px;min-height:44px;font-size:12px;";
  doctorRow.append(doctor, "Doctor visit (strong charge, reveals hidden)");
  const restart = document.createElement("button");
  restart.type = "button";
  restart.textContent = "Restart battle with this loadout";
  restart.style.cssText = control;
  restart.addEventListener("click", () =>
    opts.onRestart?.({
      med: Number(med.value) / 100,
      doctor: doctor.checked,
      residual: Number(residual.value) / 100,
    }),
  );

  const sessionRows: HTMLElement[] = [];
  if (opts.session) {
    const session = opts.session;
    const check = (text: string, on: boolean, change: (v: boolean) => void) => {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = on;
      cb.style.cssText = "width:20px;height:20px;margin:0;";
      cb.addEventListener("change", () => change(cb.checked));
      const row = document.createElement("label");
      row.style.cssText =
        "display:flex;align-items:center;gap:8px;min-height:44px;font-size:12px;";
      row.append(cb, text);
      return row;
    };
    const status = document.createElement("div");
    status.setAttribute("role", "status");
    status.style.cssText = "font-size:12px;min-height:1.2em;";
    const exportBtn = document.createElement("button");
    exportBtn.type = "button";
    exportBtn.textContent = "Export session JSON";
    exportBtn.style.cssText = control;
    exportBtn.addEventListener("click", () => {
      downloadText(session.fileName, session.exportJson());
      status.textContent = "Saved a file.";
    });
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.textContent = "Copy session JSON";
    copyBtn.style.cssText = control;
    copyBtn.addEventListener("click", () => {
      void copyText(session.exportJson()).then((ok) => {
        status.textContent = ok ? "Copied." : "Copy was blocked. Use Export.";
      });
    });
    sessionRows.push(
      check(
        "Show the 'you brought' strip at battle start",
        session.brought,
        session.onBrought,
      ),
      check(
        "Prediction probe on turns 2, 4 and 6",
        session.probe,
        session.onProbe,
      ),
      exportBtn,
      copyBtn,
      status,
    );
  }

  const stats = document.createElement("div");
  stats.style.cssText = "font:11px monospace;opacity:0.8;padding:0 4px;";

  body.append(label("Screen", modeSelect), label("Seed", seed), ...sessionRows);
  if (mode === "battle") {
    body.prepend(label("Scenario", select));
    body.append(
      sliderRow("Medication level", med),
      doctorRow,
      sliderRow("Residual kill chance", residual),
      restart,
      skipRow,
    );
  }

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
    setSeed(n) {
      seed.value = String(n);
    },
  };
}
