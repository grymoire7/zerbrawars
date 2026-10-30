import type * as THREE from "three";
import type { BattleState } from "../sim/types";

/** What a screen (battle or life phase) is given to build on. */
export interface ScreenEnv {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  /** A fresh child scene for this screen's meshes; removed when the screen is disposed. */
  readonly root: THREE.Scene;
  readonly panels: { readonly scroll: HTMLElement; readonly bar: HTMLElement };
  /** Full-window overlay for modals. */
  readonly ui: HTMLElement;
  /** Switch screens. The campaign loop will drive this later. */
  readonly go: (to: ScreenRequest) => void;
}

export interface Screen {
  tick(dtSeconds: number): void;
  setStats(text: string): void;
  dispose(): void;
}

/** Where to go next. A battle may arrive with a ready state (from the life phase). */
export type ScreenRequest =
  | { readonly mode: "battle"; readonly battle?: BattleState }
  | { readonly mode: "life" };

export type Mode = ScreenRequest["mode"];

/** `?mode=life` opens the calendar; anything else is the battle. */
export function parseMode(params: URLSearchParams): Mode {
  return params.get("mode") === "life" ? "life" : "battle";
}
