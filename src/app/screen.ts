import type * as THREE from "three";
import type { BattleState } from "../sim/types";
import type { ArcId, VariantId } from "./arcs";
import type { Run } from "./run";
import type { TutorialPart } from "./tutorialModel";

/** What a screen (battle or life phase) is given to build on. */
export interface ScreenEnv {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.PerspectiveCamera;
  /** A fresh child scene for this screen's meshes; removed when the screen is disposed. */
  readonly root: THREE.Scene;
  readonly panels: {
    readonly coach: HTMLElement;
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
  /**
   * Browser Back during play (a screen with the game menu): open or close the menu. Absent on
   * screens where Back should simply behave as the browser does.
   */
  back?(): void;
  dispose(): void;
}

/**
 * Where to go next. A battle may arrive with a ready state (from the life phase), and the
 * campaign screens carry their Run. `campaign` starts a fresh run from the URL's debug start.
 * The title, arc picker and arc-complete screens carry the chosen variant (and arc);
 * `arcPlay` starts an arc.
 */
export type ScreenRequest =
  | { readonly mode: "battle"; battle?: BattleState; run?: Run }
  | { readonly mode: "life"; run?: Run }
  | { readonly mode: "campaign"; seed?: number; variant?: VariantId }
  | { readonly mode: "quiet"; run: Run }
  | { readonly mode: "summary"; run: Run }
  | { readonly mode: "epilogue"; run: Run }
  | { readonly mode: "title" }
  | { readonly mode: "arcs"; variant: VariantId }
  | {
      readonly mode: "arcPlay";
      arc: ArcId;
      variant: VariantId;
      /** A given seed (Replay); absent, the run's own. */
      seed?: number;
      /** Arc 1 only: play this part now. Absent, the arc opens with its intro card. */
      part?: TutorialPart;
      /** Arc 2 only: the intro card has been seen (Begin, or a restart). Absent, the arc opens with it. */
      introSeen?: boolean;
    }
  | { readonly mode: "arcIntro"; arc: ArcId; variant: VariantId; seed?: number }
  | { readonly mode: "continue" }
  | { readonly mode: "arcComplete"; arc: ArcId; variant: VariantId };

export type Mode = "campaign" | "life" | "battle";

/** No `mode` starts the campaign; `?mode=life` and `?mode=battle` are standalone debug entries. */
export function parseMode(params: URLSearchParams): Mode {
  const m = params.get("mode");
  return m === "life" || m === "battle" ? m : "campaign";
}
