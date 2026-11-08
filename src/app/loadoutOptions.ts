import type { Loadout } from "../sim/life/loadout";
import { PARAMS } from "../sim/params";
import { SCENARIO_LOADOUTS, type ScenarioName } from "../sim/scenarios";

/** The loadout levers the debug panel and the URL (?med=0.6&doctor=1&residual=0.2) can set. */
export interface LoadoutOptions {
  /** 0..1. */
  readonly med: number;
  readonly doctor: boolean;
  /** 0..1 residual kill chance. */
  readonly residual: number;
}

export const DEFAULT_OPTIONS: LoadoutOptions = {
  med: 1,
  doctor: false,
  residual: PARAMS.residualKillChance,
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const unit = (raw: string | null, fallback: number, name: string): number => {
  if (raw === null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    console.warn(`Invalid ${name} "${raw}", using ${fallback}`);
    return fallback;
  }
  return clamp01(n);
};

/** Reads med, doctor and residual from URL parameters; anything missing or invalid is the default. */
export function parseLoadoutParams(params: URLSearchParams): LoadoutOptions {
  const doctor = params.get("doctor");
  return {
    med: unit(params.get("med"), DEFAULT_OPTIONS.med, "med"),
    doctor: doctor === "1" || doctor === "true",
    residual: unit(
      params.get("residual"),
      DEFAULT_OPTIONS.residual,
      "residual",
    ),
  };
}

/** Writes only the options that differ from the defaults, so plain URLs stay plain. */
export function writeLoadoutParams(url: URL, o: LoadoutOptions): void {
  const set = (key: string, value: string | null) => {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  };
  set("med", o.med === DEFAULT_OPTIONS.med ? null : String(o.med));
  set("doctor", o.doctor ? "1" : null);
  set(
    "residual",
    o.residual === DEFAULT_OPTIONS.residual ? null : String(o.residual),
  );
}

/**
 * The scenario's preset loadout (first-board and friends) with the chosen levers applied. A
 * residual chance the scenario fixes itself (tutorial-a) stays; the lever fills in the rest.
 */
export function loadoutFor(
  scenario: ScenarioName,
  seed: number,
  o: LoadoutOptions,
): Loadout {
  const preset = SCENARIO_LOADOUTS[scenario](seed, clamp01(o.med));
  return {
    ...preset,
    doctorVisit: o.doctor,
    residualKillChance: preset.residualKillChance ?? clamp01(o.residual),
  };
}
