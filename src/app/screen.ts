import type * as THREE from "three";
import type { BattleState } from "../sim/types";
import type { Run } from "./run";

/** What a screen (battle or life phase) is given to build on. */
export interface ScreenEnv {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  /** A fresh child scene for this screen's meshes; removed when the screen is disposed. */
  readonly root: THREE.Scene;
  readonly panels: {
    readonly status: HTMLElement;
    readonly scroll: HTMLElement;
    readonly bar: HTMLElement;
  };
  /** Full-window overlay for modals. */
  readonly ui: HTMLElement;
  /** Switch screens. */
  readonly go: (to: ScreenRequest) => void;
}

export interface Screen {
  tick(dtSeconds: number): void;
  setStats(text: string): void;
  dispose(): void;
}

/**
 * Where to go next. A battle may arrive with a ready state (from the life phase), and the
 * campaign screens carry their Run. `campaign` starts a fresh run from the URL's debug start.
 */
export type ScreenRequest =
  | { readonly mode: "battle"; battle?: BattleState; run?: Run }
  | { readonly mode: "life"; run?: Run }
  | { readonly mode: "campaign"; seed?: number }
  | { readonly mode: "quiet"; run: Run }
  | { readonly mode: "summary"; run: Run };

export type Mode = "campaign" | "life" | "battle";

/** No `mode` starts the campaign; `?mode=life` and `?mode=battle` are standalone debug entries. */
export function parseMode(params: URLSearchParams): Mode {
  const m = params.get("mode");
  return m === "life" || m === "battle" ? m : "campaign";
}
