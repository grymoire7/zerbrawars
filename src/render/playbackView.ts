import * as THREE from "three";
import { PARAMS } from "../sim/params";
import type { BattleState, Coord, GranulomaId, PathogenId } from "../sim/types";
import type { BoardView } from "./boardView";
import type { FxView } from "./fxView";
import type { GranulomaView } from "./granulomaView";
import { KIND_COLOR, type PathogenView } from "./pathogenView";
import { beatProgress, type Beat, type Playback } from "./playback";
import type { SwarmView } from "./swarmView";
import { PALETTE, hex } from "../theme/palette";

/**
 * Drives the views from a Playback. Every frame is posed from scratch from the timeline time, so
 * the picture is a pure function of `t`: replay, 2x and skip cannot drift. The views keep showing
 * the pre-turn state underneath; `end()` hands them back to plain state.
 */
export interface PlaybackView {
  begin(pb: Playback): void;
  frame(t: number): void;
  end(): void;
  /** Reduced motion: no playback, just a short tint on every tile the turn touched. */
  summary(pb: Playback): void;
  /** Advances the summary pulse; call every frame. */
  tick(dtSeconds: number): void;
  /** Tissue health to show mid-playback, ticking with TissueDamaged. */
  tissue(): number | null;
}

interface Views {
  board: BoardView;
  swarms: SwarmView;
  pathogens: PathogenView;
  granulomas: GranulomaView;
  fx: FxView;
  tilePosition: (c: Coord) => THREE.Vector3;
}

const TOKEN_Y = 0.2;
const LIFT = 0.5;
const LABEL_LIFE = 0.95;
const SUMMARY_LIFE = 0.9;
const KILL = hex("kill");
const GOLD = hex("residual");
const LOAD = hex("swarm-loaded");
const BLOCK = hex("warn-line");
const SPORE = hex("spore");
const GROW = hex("grow");
const WALL = hex("granuloma");
const DOSE = hex("med");
const PING = hex("focus");
const DOSE_HEIGHT = 4.2;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const easeOut = (x: number) => 1 - (1 - x) ** 3;
const easeIn = (x: number) => x * x * x;
const easeInOut = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
const back = (x: number) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
/** Drops in from above, overshoots small and settles: a thud. */
const thud = (x: number) =>
  x <= 0
    ? 0
    : x < 0.6
      ? easeIn(x / 0.6) * 1.15
      : 1.15 - 0.15 * easeOut((x - 0.6) / 0.4);
const bump = (x: number) => Math.sin(Math.PI * clamp01(x));

/** World positions a beat needs, worked out once at begin(). */
interface Cache {
  readonly beat: Beat;
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  /** Unit horizontal direction a -> b. */
  readonly dir: THREE.Vector3;
  readonly path: THREE.Vector3[];
  readonly cum: number[];
  readonly color: number;
  readonly seed: number;
}

export function createPlaybackView(v: Views): PlaybackView {
  let pb: Playback | null = null;
  let caches: Cache[] = [];
  let children: PathogenId[] = [];
  let formed: GranulomaId[] = [];
  let revealed: PathogenId[] = [];
  let tissueShown: number | null = null;
  let summaryTiles: Coord[] = [];
  let summaryT = -1;
  const tmp = new THREE.Vector3();

  const colorOf = (state: BattleState, id: PathogenId) => {
    const p = state.pathogens.find((q) => q.id === id);
    return p ? KIND_COLOR[p.kind] : GROW;
  };

  const cache = (beat: Beat, i: number, before: BattleState): Cache => {
    const pos = (c: Coord) => v.tilePosition(c);
    let a = new THREE.Vector3();
    let b = new THREE.Vector3();
    let path: THREE.Vector3[] = [];
    let color = GROW;
    switch (beat.kind) {
      case "move":
        path = beat.path.map(pos);
        a = path[0]!.clone();
        b = path[path.length - 1]!.clone();
        break;
      case "engulf":
        a = pos(beat.from);
        b = pos(beat.at);
        color = colorOf(before, beat.pathogenId);
        break;
      case "spread":
      case "spore":
        a = pos(beat.from);
        b = pos(beat.to);
        color = colorOf(before, beat.pathogenId);
        break;
      case "blocked":
        a = pos(beat.from);
        b = pos(beat.at);
        color = colorOf(before, beat.pathogenId);
        break;
      case "grow":
      case "killed":
      case "reveal":
      case "dose":
      case "walled":
      case "carried":
      case "inflame":
        a = pos(beat.at);
        b = a.clone();
        break;
      case "tissue":
        break;
    }
    const cum = [0];
    for (let k = 1; k < path.length; k++) {
      cum.push(cum[k - 1]! + path[k]!.distanceTo(path[k - 1]!));
    }
    const dir = b.clone().sub(a).setY(0);
    if (dir.lengthSq() > 0) dir.normalize();
    return { beat, a, b, dir, path, cum, color, seed: i * 7919 + 13 };
  };

  /** A label that pops in at `from` seconds and floats up for LABEL_LIFE (scaled with the turn). */
  const label = (
    t: number,
    from: number,
    text: string,
    color: string,
    at: THREE.Vector3,
    y: number,
    scale = 1,
  ) => {
    if (!pb) return;
    const life = LABEL_LIFE * pb.timeline.compression;
    const q = (t - from) / life;
    if (q < 0 || q > 1) return;
    const opacity = Math.min(q / 0.12, 1 - seg(q, 0.7, 1));
    const pop = 0.75 + 0.25 * back(clamp01(q * 4));
    v.fx.label(
      text,
      color,
      at.x,
      at.y + y + 0.3 * easeOut(q),
      at.z,
      opacity,
      scale * pop,
    );
  };

  const engulf = (c: Cache, t: number, p: number) => {
    const beat = c.beat;
    if (beat.kind !== "engulf") return;
    const pose = v.swarms.pose(beat.swarmId);
    const at = c.b;
    const roll = beat.chance !== null && beat.chance > 0;
    const killed = beat.outcome !== "load";
    const time = (x: number) => beat.start + beat.duration * x;

    // Pour on, squeeze, outcome, let go.
    const wrapIn = easeOut(seg(p, 0, 0.32));
    const letGo = easeInOut(seg(p, 0.82, 1));
    const squeeze = easeInOut(seg(p, 0.32, 0.55));
    const out = seg(p, 0.55, 0.85);
    if (pose) {
      pose.wrap = wrapIn * (1 - letGo);
      pose.wrapAt.set(at.x, at.y + 0.12, at.z);
      pose.wrapRadius = 1 - 0.25 * squeeze;
      if (roll) pose.flash = 0.35 * bump(seg(p, 0.36, 0.5));
      if (killed) {
        pose.wrapRadius += 0.7 * easeOut(seg(p, 0.55, 0.72)) * (1 - letGo);
        pose.flash = Math.max(
          pose.flash,
          Math.min(seg(p, 0.55, 0.59), 1 - seg(p, 0.6, 0.85)),
        );
      } else {
        const before = beat.load > 1 ? 1 : 0;
        pose.wrapRadius -= 0.25 * easeInOut(seg(p, 0.55, 0.7));
        pose.swell = Math.min(
          1.12,
          before + (1 - before) * back(seg(p, 0.6, 0.85)),
        );
        pose.load = p >= 0.68 ? beat.load : beat.load - 1;
      }
    }

    // The token struggles, then vanishes in the flash or is drawn into the swarm.
    const shake = Math.sin(t * 45) * 0.04 * squeeze * (1 - out);
    let scale = 1 - 0.18 * squeeze + shake;
    let dy = 0;
    if (killed) scale *= 1 - easeIn(seg(p, 0.55, 0.66));
    else {
      scale *= 1 - easeIn(seg(p, 0.55, 0.78));
      dy = -0.12 * seg(p, 0.55, 0.78);
    }
    v.pathogens.setPose(beat.pathogenId, scale, 1, 0, dy, 0);

    const cy = at.y + TOKEN_Y;
    if (roll && p > 0.36) {
      // The residual roll: a faint ring tightening on the token.
      const q = seg(p, 0.36, 0.55);
      v.fx.ring(at.x, at.y + 0.04, at.z, 0.6 - 0.3 * q, 0.6 * bump(q), GOLD);
    }
    if (killed) {
      const color = beat.outcome === "residualKill" ? GOLD : KILL;
      const q = seg(p, 0.55, 0.9);
      v.fx.ring(at.x, at.y + 0.05, at.z, 0.2 + 0.9 * easeOut(q), 1 - q, color);
      const q2 = seg(p, 0.6, 0.95);
      v.fx.ring(
        at.x,
        at.y + 0.05,
        at.z,
        0.1 + 0.5 * easeOut(q2),
        0.8 * (1 - q2),
        hex("white"),
      );
      v.fx.burst(c.seed, at.x, cy, at.z, q, 26, 1.5, color);
      label(
        t,
        time(0.56),
        beat.outcome === "residualKill" ? "RESIDUAL KILL" : "KILLED",
        beat.outcome === "residualKill" ? PALETTE.residual : PALETTE.kill,
        at,
        0.75,
      );
    } else {
      if (roll) {
        v.fx.burst(
          c.seed,
          at.x,
          cy + 0.2,
          at.z,
          seg(p, 0.5, 0.75),
          8,
          0.4,
          hex("text-muted"),
        );
        label(
          t,
          time(0.48),
          "kill roll failed",
          PALETTE["text-muted"],
          at,
          0.6,
          0.75,
        );
      }
      const q = seg(p, 0.6, 1);
      v.fx.ring(
        at.x,
        at.y + 0.04,
        at.z,
        0.35 + 0.35 * easeOut(q),
        0.55 * bump(q),
        LOAD,
      );
      label(
        t,
        time(0.66),
        `LOADED ${beat.load}/${PARAMS.loadCap}`,
        PALETTE["text-muted"],
        at,
        roll ? 1.0 : 0.75,
      );
    }
  };

  /** A dose falls from above the board onto the target; a pathogen dies, a carried load is cleared. */
  const dose = (c: Cache, t: number, p: number) => {
    const beat = c.beat;
    if (beat.kind !== "dose") return;
    const time = (x: number) => beat.start + beat.duration * x;
    const hit = 0.5;
    const fall = easeIn(seg(p, 0.05, hit));
    const top = c.a.y + DOSE_HEIGHT;
    const killed = beat.target === "pathogen";
    if (p < hit) {
      // A drop with a short streak behind it, plus a faint column down to the target.
      for (let k = 0; k < 5; k++) {
        const fk = Math.max(0, fall - k * 0.06);
        if (fall <= 0) break;
        v.fx.blob(
          c.a.x,
          top - (top - c.a.y - TOKEN_Y) * fk,
          c.a.z,
          0.16 * (1 - k * 0.15),
          DOSE,
          1 - k * 0.2,
        );
      }
      v.fx.ring(
        c.a.x,
        c.a.y + 0.04,
        c.a.z,
        0.5,
        0.35 * seg(p, 0.05, hit),
        DOSE,
      );
    }
    if (killed && beat.pathogenId) {
      v.pathogens.setPose(
        beat.pathogenId,
        1 - easeIn(seg(p, hit, hit + 0.12)),
        1,
        0,
        0,
        0,
      );
    }
    const pose = beat.swarmId ? v.swarms.pose(beat.swarmId) : null;
    if (pose && !killed) {
      pose.flash = 0.5 * bump(seg(p, hit, 0.9));
      pose.load = p >= hit ? beat.load : beat.loadBefore;
      if (p >= hit && beat.load === 0) pose.swell = 0;
    }
    if (p >= hit) {
      const q = seg(p, hit, 0.95);
      v.fx.ring(
        c.a.x,
        c.a.y + 0.05,
        c.a.z,
        0.2 + 0.9 * easeOut(q),
        1 - q,
        killed ? KILL : DOSE,
      );
      v.fx.ring(
        c.a.x,
        c.a.y + 0.05,
        c.a.z,
        0.1 + 0.5 * easeOut(seg(p, hit + 0.05, 1)),
        0.8 * (1 - seg(p, hit + 0.05, 1)),
        hex("white"),
      );
      v.fx.burst(c.seed, c.a.x, c.a.y + TOKEN_Y, c.a.z, q, 22, 1.4, DOSE);
      label(
        t,
        time(hit),
        killed ? `${beat.charge} dose` : `${beat.charge}: load cleared`,
        PALETTE.med,
        c.a,
        0.8,
        0.9,
      );
      if (killed) label(t, time(hit + 0.1), "KILLED", PALETTE.kill, c.a, 1.1);
    }
  };

  const apply = (c: Cache, t: number) => {
    const beat = c.beat;
    const p = beatProgress(beat, t);
    const time = (x: number) => beat.start + beat.duration * x;
    switch (beat.kind) {
      case "move": {
        const pose = v.swarms.pose(beat.swarmId);
        if (!pose) return;
        pose.path = c.path;
        pose.cum = c.cum;
        pose.progress = easeInOut(p);
        pose.stream = bump(p);
        return;
      }
      case "engulf":
        return engulf(c, t, p);
      case "killed": {
        v.pathogens.setPose(
          beat.pathogenId,
          1 - easeIn(seg(p, 0.15, 0.35)),
          1,
          0,
          0,
          0,
        );
        const q = seg(p, 0.15, 1);
        v.fx.ring(
          c.a.x,
          c.a.y + 0.05,
          c.a.z,
          0.2 + 0.8 * easeOut(q),
          1 - q,
          KILL,
        );
        v.fx.burst(c.seed, c.a.x, c.a.y + TOKEN_Y, c.a.z, q, 20, 1.3, KILL);
        label(t, time(0.2), "KILLED", PALETTE.kill, c.a, 0.75);
        return;
      }
      case "reveal": {
        // The token pops out of hiding with a small ping.
        const pop = back(seg(p, 0.1, 0.55));
        v.pathogens.setPose(beat.pathogenId, Math.max(0, pop), 1, 0, 0, 0);
        const q = seg(p, 0.15, 1);
        v.fx.ring(
          c.a.x,
          c.a.y + 0.04,
          c.a.z,
          0.25 + 0.55 * easeOut(q),
          0.8 * (1 - q),
          PING,
        );
        v.fx.ring(
          c.a.x,
          c.a.y + 0.04,
          c.a.z,
          0.15 + 0.35 * easeOut(seg(p, 0.3, 1)),
          0.6 * (1 - seg(p, 0.3, 1)),
          hex("white"),
        );
        label(t, time(0.25), "revealed", PALETTE.focus, c.a, 0.85);
        return;
      }
      case "dose":
        return dose(c, t, p);
      case "walled": {
        // The load packs down into a block that thuds onto the tile; the swarm lets go.
        const pose = v.swarms.pose(beat.swarmId);
        if (pose) {
          pose.swell = 1 - easeIn(seg(p, 0.3, 0.6));
          pose.load = p >= 0.5 ? 0 : -1;
          pose.jolt = 0.6 * bump(seg(p, 0.45, 0.7));
        }
        v.granulomas.setPose(beat.granulomaId, thud(seg(p, 0.3, 0.75)));
        const q = seg(p, 0.4, 1);
        v.fx.ring(
          c.a.x,
          c.a.y + 0.05,
          c.a.z,
          0.3 + 0.45 * easeOut(q),
          0.85 * (1 - q) * (p >= 0.4 ? 1 : 0),
          WALL,
        );
        v.fx.burst(c.seed, c.a.x, c.a.y + 0.1, c.a.z, q, 12, 0.9, WALL);
        v.board.setPulse(beat.at, 0.6 * bump(seg(p, 0.4, 1)));
        label(t, time(0.45), "WALLED OFF", PALETTE.goal, c.a, 0.95);
        return;
      }
      case "carried": {
        const pose = v.swarms.pose(beat.swarmId);
        if (pose) {
          pose.flash = beat.success ? 0.5 * bump(seg(p, 0.35, 0.8)) : 0;
          if (p >= 0.5) {
            pose.load = beat.load;
            if (beat.load === 0) pose.swell = 0;
          }
        }
        const q = seg(p, 0.2, 0.9);
        v.fx.ring(
          c.a.x,
          c.a.y + 0.05,
          c.a.z,
          0.55 - 0.25 * q,
          0.6 * bump(q),
          beat.success ? GOLD : LOAD,
        );
        if (beat.success) {
          v.fx.burst(
            c.seed,
            c.a.x,
            c.a.y + 0.3,
            c.a.z,
            seg(p, 0.5, 1),
            10,
            0.8,
            GOLD,
          );
        }
        label(
          t,
          time(0.4),
          beat.success ? "carried kill: success" : "carried kill: failed",
          beat.success ? PALETTE.residual : PALETTE["text-muted"],
          c.a,
          0.85,
          0.8,
        );
        return;
      }
      case "grow": {
        const g = seg(p, 0.05, 0.85);
        v.pathogens.setPose(
          beat.pathogenId,
          1 + 0.3 * bump(g),
          1 + 0.12 * bump(g * 2),
          0,
          0,
          0,
        );
        v.pathogens.setSize(
          beat.pathogenId,
          p >= 0.45 ? beat.size : beat.sizeBefore,
        );
        const q = seg(p, 0.4, 1);
        v.fx.ring(
          c.a.x,
          c.a.y + 0.04,
          c.a.z,
          0.3 + 0.3 * easeOut(q),
          0.7 * (1 - q),
          GROW,
        );
        label(
          t,
          time(0.42),
          `+${beat.size - beat.sizeBefore}`,
          PALETTE.grow,
          c.a,
          0.85,
          0.8,
        );
        return;
      }
      case "spread":
      case "spore": {
        // Parent winds up (squash and lean), then pays its cost as the child leaves.
        const wind = bump(seg(p, 0, 0.35));
        v.pathogens.setPose(
          beat.pathogenId,
          1,
          1 - 0.2 * wind,
          c.dir.x * 0.1 * wind,
          0,
          c.dir.z * 0.1 * wind,
        );
        v.pathogens.setSize(
          beat.pathogenId,
          p >= 0.5 ? beat.parentSize : beat.parentSizeBefore,
        );
        const land = seg(p, 0.75, 1);
        if (beat.kind === "spread") {
          // A bud swells out of the parent and creeps onto the next tile.
          const u = easeOut(seg(p, 0.2, 0.75));
          if (p > 0.2) {
            const scale = p < 0.75 ? 0.25 + 0.5 * u : 0.75 + 0.25 * back(land);
            v.pathogens.setPose(
              beat.newPathogenId,
              scale,
              1,
              (c.a.x - c.b.x) * (1 - u),
              0,
              (c.a.z - c.b.z) * (1 - u),
            );
          }
          v.fx.ring(
            c.b.x,
            c.b.y + 0.04,
            c.b.z,
            0.3 + 0.25 * easeOut(land),
            0.7 * bump(land),
            c.color,
          );
        } else {
          const u = seg(p, 0.15, 0.75);
          if (u > 0 && u < 1) {
            for (let k = 0; k < 4; k++) {
              const uk = u - k * 0.045;
              if (uk <= 0) break;
              arc(c, uk, tmp);
              v.fx.blob(
                tmp.x,
                tmp.y,
                tmp.z,
                0.11 * (1 - k * 0.2),
                SPORE,
                1 - k * 0.25,
              );
            }
          }
          if (p >= 0.75) {
            v.pathogens.setPose(beat.newPathogenId, back(land), 1, 0, 0, 0);
          }
          v.fx.ring(
            c.b.x,
            c.b.y + 0.04,
            c.b.z,
            0.2 + 0.4 * easeOut(land),
            0.8 * (1 - land) * (p >= 0.75 ? 1 : 0),
            SPORE,
          );
          v.fx.burst(
            c.seed,
            c.b.x,
            c.b.y + 0.15,
            c.b.z,
            land,
            10,
            0.8,
            c.color,
          );
        }
        return;
      }
      case "blocked": {
        const wind = bump(seg(p, 0, 0.3));
        v.pathogens.setPose(beat.pathogenId, 1, 1 - 0.18 * wind, 0, 0, 0);
        const hit = 0.45;
        const pose = v.swarms.pose(beat.swarmId);
        if (pose) pose.jolt = bump(seg(p, hit, hit + 0.3));
        let ix: number;
        let iy: number;
        let iz: number;
        if (beat.intent === "spread") {
          // The bud pushes toward the swarm, hits its edge and recoils.
          ix = c.b.x - c.dir.x * 0.42;
          iz = c.b.z - c.dir.z * 0.42;
          iy = c.b.y + TOKEN_Y;
          if (p < hit) {
            const u = easeIn(seg(p, 0.05, hit));
            v.fx.blob(
              c.a.x + (ix - c.a.x) * u,
              c.a.y + TOKEN_Y,
              c.a.z + (iz - c.a.z) * u,
              0.07 + 0.08 * u,
              c.color,
              1,
            );
          }
        } else {
          // The spore drops onto the swarm and bounces off.
          ix = c.b.x;
          iz = c.b.z;
          iy = c.b.y + 0.45;
          if (p < hit) {
            arcTo(c, seg(p, 0.05, hit), iy, tmp);
            v.fx.blob(tmp.x, tmp.y, tmp.z, 0.09, SPORE, 1);
          }
        }
        if (p >= hit) {
          const u = seg(p, hit, 0.85);
          const color = beat.intent === "spread" ? c.color : SPORE;
          v.fx.blob(
            ix - c.dir.x * 0.5 * easeOut(u),
            iy + 0.35 * bump(u * 0.8) - 0.25 * u * u,
            iz - c.dir.z * 0.5 * easeOut(u),
            0.12 * (1 - u),
            color,
            1 - u,
          );
          const q = seg(p, hit, 0.8);
          v.fx.ring(
            ix,
            c.b.y + 0.06,
            iz,
            0.12 + 0.5 * easeOut(q),
            1 - q,
            BLOCK,
          );
          v.fx.burst(c.seed, ix, iy, iz, q, 14, 1.1, BLOCK);
        }
        label(t, time(hit), "BLOCKED", PALETTE.blocked, c.b, 0.95);
        return;
      }
      case "inflame":
        v.board.setPulse(beat.at, bump(p));
        return;
      case "tissue":
        tissueShown = Math.round(
          beat.from + (beat.to - beat.from) * seg(p, 0.2, 0.8),
        );
        return;
    }
  };

  /** Point `u` along the telegraph's spore arc (same peak), into `out`. */
  const arc = (c: Cache, u: number, out: THREE.Vector3) => {
    const dist = Math.hypot(c.b.x - c.a.x, c.b.z - c.a.z);
    const peak = 0.4 + dist * 0.22;
    return out.set(
      c.a.x + (c.b.x - c.a.x) * u,
      c.a.y + LIFT + 4 * peak * u * (1 - u),
      c.a.z + (c.b.z - c.a.z) * u,
    );
  };
  const arcTo = (c: Cache, u: number, endY: number, out: THREE.Vector3) => {
    arc(c, u, out);
    out.y += (endY - (c.a.y + LIFT)) * u;
    return out;
  };

  const summaryCoords = (p: Playback) =>
    p.timeline.beats.flatMap((b): Coord[] => {
      switch (b.kind) {
        case "move":
          return [b.path[b.path.length - 1]!];
        case "engulf":
          return [b.at];
        case "spread":
        case "spore":
          return [b.to];
        case "tissue":
          return [];
        default:
          return [b.at];
      }
    });

  return {
    begin(next) {
      pb = next;
      const before = next.before;
      caches = next.timeline.beats.map((b, i) => cache(b, i, before));
      children = next.timeline.beats.flatMap((b) =>
        b.kind === "spread" || b.kind === "spore" ? [b.newPathogenId] : [],
      );
      const born = new Set(children);
      formed = next.timeline.beats.flatMap((b) =>
        b.kind === "walled" ? [b.granulomaId] : [],
      );
      revealed = next.timeline.beats.flatMap((b) =>
        b.kind === "reveal" ? [b.pathogenId] : [],
      );
      v.board.update(before);
      v.swarms.update(before, true);
      v.pathogens.update(before, [
        ...before.pathogens.map((p) =>
          revealed.includes(p.id) ? { ...p, hidden: false } : p,
        ),
        ...next.after.pathogens.filter((p) => born.has(p.id)),
      ]);
      v.granulomas.update(before, [
        ...before.granulomas,
        ...next.after.granulomas.filter((g) => formed.includes(g.id)),
      ]);
      tissueShown = before.tissueHealth;
      summaryT = -1;
    },
    frame(t) {
      if (!pb) return;
      v.swarms.clearPoses();
      v.pathogens.clearPoses();
      v.granulomas.clearPoses();
      v.board.clearPulses();
      v.fx.reset();
      for (const id of children) v.pathogens.setPose(id, 0, 1, 0, 0, 0);
      for (const id of revealed) v.pathogens.setPose(id, 0, 1, 0, 0, 0);
      for (const id of formed) v.granulomas.setPose(id, 0);
      tissueShown = pb.before.tissueHealth;
      for (const c of caches) {
        if (t >= c.beat.start) apply(c, t);
      }
      v.fx.commit();
    },
    end() {
      pb = null;
      caches = [];
      children = [];
      formed = [];
      revealed = [];
      tissueShown = null;
      v.swarms.clearPoses();
      v.pathogens.clearPoses();
      v.granulomas.clearPoses();
      v.board.clearPulses();
      v.fx.reset();
      v.fx.commit();
    },
    summary(p) {
      summaryTiles = summaryCoords(p);
      summaryT = 0;
    },
    tick(dt) {
      if (summaryT < 0) return;
      summaryT += dt;
      const q = summaryT / SUMMARY_LIFE;
      v.board.clearPulses();
      if (q >= 1) {
        summaryT = -1;
        return;
      }
      // Fades only, no movement.
      for (const c of summaryTiles) v.board.setPulse(c, 0.9 * (1 - q));
    },
    tissue: () => tissueShown,
  };
}
