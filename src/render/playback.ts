// Pure (no three): turns a resolved turn into a timeline the views animate. Lives in render because
// only presentation reads it; the sim never sees playback.
import type {
  BattleState,
  ChargeKind,
  Coord,
  GranulomaId,
  PathogenId,
  SimEvent,
  SwarmId,
} from "../sim/types";

export type Phase = "move" | "engulf" | "pathogen" | "tick";

interface BeatBase {
  readonly phase: Phase;
  /** Seconds from the start of playback (after compression). */
  readonly start: number;
  readonly duration: number;
  /** When this beat's log lines appear (the impact moment). */
  readonly reveal: number;
  /** Indices into the event list this beat plays. */
  readonly events: readonly number[];
}

export type EngulfOutcome = "kill" | "residualKill" | "load";

export type Beat = BeatBase &
  (
    | {
        readonly kind: "move";
        readonly swarmId: SwarmId;
        readonly path: readonly Coord[];
      }
    | {
        readonly kind: "engulf";
        readonly swarmId: SwarmId;
        readonly pathogenId: PathogenId;
        /** Where the swarm stands when it engulfs (after its move). */
        readonly from: Coord;
        readonly at: Coord;
        readonly outcome: EngulfOutcome;
        /** Residual kill chance rolled; null when nothing was rolled (leaky). */
        readonly chance: number | null;
        /** Load count after the beat. */
        readonly load: number;
      }
    | {
        readonly kind: "killed";
        readonly pathogenId: PathogenId;
        readonly at: Coord;
      }
    | {
        /** A swarm stepped next to a hidden token: it turns visible. */
        readonly kind: "reveal";
        readonly pathogenId: PathogenId;
        readonly at: Coord;
        readonly swarmId: SwarmId;
      }
    | {
        /** A support charge: a dose from above onto a pathogen, or onto a swarm's carried load. */
        readonly kind: "dose";
        readonly charge: ChargeKind;
        readonly target: "pathogen" | "load";
        readonly at: Coord;
        readonly pathogenId: PathogenId | null;
        readonly swarmId: SwarmId | null;
        /** Load count before and after (0 and 0 for a pathogen target). */
        readonly loadBefore: number;
        readonly load: number;
      }
    | {
        readonly kind: "walled";
        readonly swarmId: SwarmId;
        readonly granulomaId: GranulomaId;
        readonly at: Coord;
      }
    | {
        /** Carried-load kill rolls: a ResidualKill run with no Engulfed before it. */
        readonly kind: "carried";
        readonly swarmId: SwarmId;
        readonly at: Coord;
        readonly rolls: number;
        /** At least one roll killed its pathogen. */
        readonly success: boolean;
        /** Load count after the beat. */
        readonly load: number;
      }
    | {
        readonly kind: "grow";
        readonly pathogenId: PathogenId;
        readonly at: Coord;
        readonly sizeBefore: number;
        readonly size: number;
      }
    | {
        readonly kind: "spread" | "spore";
        readonly pathogenId: PathogenId;
        readonly newPathogenId: PathogenId;
        readonly from: Coord;
        readonly to: Coord;
        readonly size: number;
        readonly parentSizeBefore: number;
        readonly parentSize: number;
      }
    | {
        readonly kind: "blocked";
        readonly pathogenId: PathogenId;
        readonly intent: "spread" | "spore";
        readonly from: Coord;
        readonly at: Coord;
        readonly swarmId: SwarmId;
      }
    | {
        readonly kind: "inflame";
        readonly at: Coord;
        readonly inflammation: number;
      }
    | {
        readonly kind: "tissue";
        readonly from: number;
        readonly to: number;
      }
  );

export type BeatKind = Beat["kind"];

export interface PhaseSpan {
  readonly phase: Phase;
  readonly start: number;
  readonly end: number;
}

export interface Timeline {
  readonly beats: readonly Beat[];
  readonly phases: readonly PhaseSpan[];
  /** Total seconds at 1x, tail included. 0 when there is nothing to play. */
  readonly duration: number;
  /** Factor applied to fit MAX_DURATION (1 = uncompressed). */
  readonly compression: number;
}

/**
 * Seconds at 1x. Moves are short and simultaneous; engulfs are the climax, staggered so each
 * flash or swell reads on its own; pathogens cascade in telegraph order with overlap.
 */
export const TIMING = {
  moveBase: 0.3,
  movePerStep: 0.18,
  moveMax: 1.0,
  engulf: 1.05,
  engulfRoll: 1.3,
  engulfStagger: 0.28,
  grow: 0.5,
  reveal: 0.6,
  dose: 1.0,
  wall: 0.7,
  carried: 0.8,
  spread: 0.65,
  spore: 0.85,
  blocked: 0.75,
  pathogenStagger: 0.24,
  tick: 0.55,
  phaseGap: 0.18,
  tail: 0.3,
  maxDuration: 4,
} as const;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

type Draft = DistributiveOmit<Beat, "start" | "duration" | "reveal"> & {
  duration: number;
  /** Reveal as a fraction of the beat. */
  revealAt: number;
};

const PHASES: readonly Phase[] = ["move", "engulf", "pathogen", "tick"];

/**
 * Groups events into beats by phase, staggers them, and compresses the whole thing to at most
 * TIMING.maxDuration. `before` supplies what events leave out (start sizes, where a blocked
 * pathogen sits, swarm positions, starting tissue health).
 */
export function buildTimeline(
  before: BattleState,
  events: readonly SimEvent[],
): Timeline {
  const drafts: Record<Phase, Draft[]> = {
    move: [],
    engulf: [],
    pathogen: [],
    tick: [],
  };
  const swarmAt = new Map<SwarmId, Coord>(
    before.swarms.map((s) => [s.id, s.at]),
  );
  const pathogen = new Map(before.pathogens.map((p) => [p.id, p]));
  const sizes = new Map(before.pathogens.map((p) => [p.id, p.size]));
  const loads = new Map(before.swarms.map((s) => [s.id, s.load.length]));
  let tissue = before.tissueHealth;
  const inflamed = new Map<number, Draft>();

  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    switch (e.type) {
      case "SwarmMoved": {
        const steps = Math.max(1, e.path.length - 1);
        drafts.move.push({
          kind: "move",
          phase: "move",
          swarmId: e.swarmId,
          path: e.path,
          events: [i],
          duration: Math.min(
            TIMING.moveMax,
            TIMING.moveBase + TIMING.movePerStep * steps,
          ),
          revealAt: 1,
        });
        swarmAt.set(e.swarmId, e.path[e.path.length - 1]!);
        break;
      }
      case "Engulfed": {
        // Engulfed is followed by an optional ResidualKill and then Killed or Loaded.
        const idx = [i];
        let chance: number | null = null;
        let outcome: EngulfOutcome = "kill";
        let j = i + 1;
        const r = events[j];
        if (r?.type === "ResidualKill" && r.swarmId === e.swarmId) {
          chance = r.chance;
          outcome = r.success ? "residualKill" : "load";
          idx.push(j++);
        }
        const end = events[j];
        if (end?.type === "Killed" && end.pathogenId === e.pathogenId) {
          idx.push(j++);
        } else if (end?.type === "Loaded" && end.swarmId === e.swarmId) {
          outcome = "load";
          loads.set(e.swarmId, end.load.length);
          idx.push(j++);
        }
        const p = pathogen.get(e.pathogenId);
        drafts.engulf.push({
          kind: "engulf",
          phase: "engulf",
          swarmId: e.swarmId,
          pathogenId: e.pathogenId,
          from: swarmAt.get(e.swarmId) ?? p?.at ?? { x: 0, y: 0 },
          at: p?.at ?? swarmAt.get(e.swarmId) ?? { x: 0, y: 0 },
          outcome,
          chance,
          load: loads.get(e.swarmId) ?? 0,
          events: idx,
          duration:
            chance !== null && chance > 0 ? TIMING.engulfRoll : TIMING.engulf,
          revealAt: 0.6,
        });
        i = j - 1;
        break;
      }
      case "Revealed":
        drafts.engulf.push({
          kind: "reveal",
          phase: "engulf",
          pathogenId: e.pathogenId,
          at: e.at,
          swarmId: e.swarmId,
          events: [i],
          duration: TIMING.reveal,
          revealAt: 0.35,
        });
        break;
      case "SupportUsed": {
        // Followed by Killed (pathogen target) or Loaded (load target).
        const idx = [i];
        const next = events[i + 1];
        const loadBefore = e.swarmId ? (loads.get(e.swarmId) ?? 0) : 0;
        let load = loadBefore;
        if (
          e.target === "pathogen" &&
          next?.type === "Killed" &&
          next.pathogenId === e.pathogenId
        ) {
          idx.push(i + 1);
        } else if (
          e.target === "load" &&
          next?.type === "Loaded" &&
          next.swarmId === e.swarmId
        ) {
          load = next.load.length;
          loads.set(next.swarmId, load);
          idx.push(i + 1);
        }
        drafts.engulf.push({
          kind: "dose",
          phase: "engulf",
          charge: e.charge,
          target: e.target,
          at: e.at,
          pathogenId: e.pathogenId,
          swarmId: e.swarmId,
          loadBefore,
          load,
          events: idx,
          duration: TIMING.dose,
          revealAt: 0.55,
        });
        i += idx.length - 1;
        break;
      }
      case "Killed":
        drafts.engulf.push({
          kind: "killed",
          phase: "engulf",
          pathogenId: e.pathogenId,
          at: e.at,
          events: [i],
          duration: TIMING.grow,
          revealAt: 0.3,
        });
        break;
      case "Walled":
        drafts.engulf.push({
          kind: "walled",
          phase: "engulf",
          swarmId: e.swarmId,
          granulomaId: e.granulomaId,
          at: e.at,
          events: [i],
          duration: TIMING.wall,
          revealAt: 0.5,
        });
        loads.set(e.swarmId, 0);
        break;
      case "ResidualKill": {
        // A roll not folded into an Engulfed is a carried load's: the run for one swarm, then
        // the Loaded that follows if any load died.
        const idx = [i];
        let success = e.success;
        let j = i + 1;
        for (
          let r = events[j];
          r?.type === "ResidualKill" && r.swarmId === e.swarmId;
          r = events[++j]
        ) {
          success ||= r.success;
          idx.push(j);
        }
        const end = events[j];
        if (end?.type === "Loaded" && end.swarmId === e.swarmId) {
          loads.set(e.swarmId, end.load.length);
          idx.push(j++);
        }
        drafts.engulf.push({
          kind: "carried",
          phase: "engulf",
          swarmId: e.swarmId,
          at: swarmAt.get(e.swarmId) ?? { x: 0, y: 0 },
          rolls: idx.filter((n) => events[n]!.type === "ResidualKill").length,
          success,
          load: loads.get(e.swarmId) ?? 0,
          events: idx,
          duration: TIMING.carried,
          revealAt: 0.5,
        });
        i = j - 1;
        break;
      }
      case "Grew":
        drafts.pathogen.push({
          kind: "grow",
          phase: "pathogen",
          pathogenId: e.pathogenId,
          at: pathogen.get(e.pathogenId)?.at ?? { x: 0, y: 0 },
          sizeBefore: sizes.get(e.pathogenId) ?? e.size,
          size: e.size,
          events: [i],
          duration: TIMING.grow,
          revealAt: 0.45,
        });
        sizes.set(e.pathogenId, e.size);
        break;
      case "Spread":
      case "Spored":
        drafts.pathogen.push({
          kind: e.type === "Spread" ? "spread" : "spore",
          phase: "pathogen",
          pathogenId: e.pathogenId,
          newPathogenId: e.newPathogenId,
          from: e.from,
          to: e.to,
          size: e.size,
          parentSizeBefore: sizes.get(e.pathogenId) ?? e.parentSize,
          parentSize: e.parentSize,
          events: [i],
          duration: e.type === "Spread" ? TIMING.spread : TIMING.spore,
          revealAt: 0.75,
        });
        sizes.set(e.pathogenId, e.parentSize);
        sizes.set(e.newPathogenId, e.size);
        break;
      case "Blocked":
        drafts.pathogen.push({
          kind: "blocked",
          phase: "pathogen",
          pathogenId: e.pathogenId,
          intent: e.intent,
          from: pathogen.get(e.pathogenId)?.at ?? e.at,
          at: e.at,
          swarmId: e.swarmId,
          events: [i],
          duration: TIMING.blocked,
          revealAt: 0.5,
        });
        break;
      case "InflammationChanged": {
        // Several changes to one tile in a turn play as one pulse to the last value.
        const key = e.at.y * before.board.width + e.at.x;
        const prev = inflamed.get(key);
        if (prev && prev.kind === "inflame") {
          inflamed.set(key, {
            ...prev,
            inflammation: e.inflammation,
            events: [...prev.events, i],
          });
        } else {
          inflamed.set(key, {
            kind: "inflame",
            phase: "tick",
            at: e.at,
            inflammation: e.inflammation,
            events: [i],
            duration: TIMING.tick,
            revealAt: 0.4,
          });
        }
        break;
      }
      case "TissueDamaged":
        drafts.tick.push({
          kind: "tissue",
          phase: "tick",
          from: tissue,
          to: e.tissueHealth,
          events: [i],
          duration: TIMING.tick,
          revealAt: 0.4,
        });
        tissue = e.tissueHealth;
        break;
      default:
      // A stray Loaded has no beat and is revealed at the end with any other unmatched event.
    }
  }
  drafts.tick.unshift(...inflamed.values());

  const stagger: Record<Phase, number> = {
    move: 0,
    engulf: TIMING.engulfStagger,
    pathogen: TIMING.pathogenStagger,
    tick: 0,
  };
  const beats: Beat[] = [];
  const phases: PhaseSpan[] = [];
  let cursor = 0;
  for (const phase of PHASES) {
    const list = drafts[phase];
    if (list.length === 0) continue;
    if (phases.length > 0) cursor += TIMING.phaseGap;
    const start = cursor;
    let end = start;
    list.forEach((d, n) => {
      const s = start + n * stagger[phase];
      const { revealAt, duration, ...rest } = d;
      beats.push({
        ...rest,
        start: s,
        duration,
        reveal: s + duration * revealAt,
      } as Beat);
      end = Math.max(end, s + duration);
    });
    phases.push({ phase, start, end });
    cursor = end;
  }
  if (beats.length === 0) {
    return { beats, phases, duration: 0, compression: 1 };
  }
  const raw = cursor + TIMING.tail;
  const k = raw > TIMING.maxDuration ? TIMING.maxDuration / raw : 1;
  if (k === 1) return { beats, phases, duration: raw, compression: 1 };
  return {
    beats: beats.map((b) => ({
      ...b,
      start: b.start * k,
      duration: b.duration * k,
      reveal: b.reveal * k,
    })),
    phases: phases.map((p) => ({ ...p, start: p.start * k, end: p.end * k })),
    duration: TIMING.maxDuration,
    compression: k,
  };
}

/** 0..1 progress of `beat` at time `t` (0 before it starts, 1 once it ends). */
export function beatProgress(beat: Beat, t: number): number {
  if (beat.duration <= 0) return t >= beat.start ? 1 : 0;
  return Math.min(1, Math.max(0, (t - beat.start) / beat.duration));
}

export type Speed = 1 | 2;

/**
 * One turn's playback. Shows `before` while playing and `after` once done; the views animate the
 * gap from the timeline. Skipping only moves the clock, so it always lands on `after`.
 */
export interface Playback {
  readonly before: BattleState;
  readonly after: BattleState;
  readonly events: readonly SimEvent[];
  readonly timeline: Timeline;
  /** Seconds into the timeline. */
  readonly time: number;
  readonly done: boolean;
  /** Ended by skip rather than by running out. */
  readonly skipped: boolean;
  speed: Speed;
  /** Advances by real seconds (times speed). True if what the HUD shows changed. */
  advance(dtSeconds: number): boolean;
  skip(): void;
  /** Events whose beat has reached its impact, in event order. */
  revealed(): readonly SimEvent[];
  /** The state the board should show: `before` while playing, `after` when done. */
  displayState(): BattleState;
}

export function createPlayback(
  before: BattleState,
  events: readonly SimEvent[],
  after: BattleState,
  speed: Speed = 1,
): Playback {
  const timeline = buildTimeline(before, events);
  const revealAt = new Float64Array(events.length).fill(timeline.duration);
  for (const b of timeline.beats) {
    for (const i of b.events) revealAt[i] = b.reveal;
  }
  let time = 0;
  let done = timeline.duration === 0;
  let skipped = false;
  let shown = done ? events.length : 0;
  const count = () => {
    if (done) return events.length;
    let n = 0;
    for (let i = 0; i < revealAt.length; i++) if (revealAt[i]! <= time) n++;
    return n;
  };
  const pb: Playback = {
    before,
    after,
    events,
    timeline,
    get time() {
      return time;
    },
    get done() {
      return done;
    },
    get skipped() {
      return skipped;
    },
    speed,
    advance(dt) {
      if (done) return false;
      time = Math.min(timeline.duration, time + dt * pb.speed);
      if (time >= timeline.duration) done = true;
      const n = count();
      const changed = n !== shown || done;
      shown = n;
      return changed;
    },
    skip() {
      if (done) return;
      skipped = true;
      time = timeline.duration;
      done = true;
      shown = events.length;
    },
    revealed() {
      if (done) return events;
      return events.filter((_, i) => revealAt[i]! <= time);
    },
    displayState: () => (done ? after : before),
  };
  return pb;
}
