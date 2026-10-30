import { sameCoord } from "../sim/board";
import { telegraph, type TelegraphMark } from "../sim/battle/intents";
import {
  availableCharges,
  supportPreview,
  supportTargets,
  type SupportPreview,
} from "../sim/battle/support";
import {
  engulfPreview,
  engulfTargets,
  moveOptions,
  swarmMoveRange,
  wallOffPreview,
  withOrder,
  type EngulfTarget,
  type WallOffPreview,
} from "../sim/battle/orders";
import { battleStatus, gradeOutcome } from "../sim/battle/outcome";
import { PARAMS } from "../sim/params";
import {
  inflammationPreview,
  resolveTurn,
  turnProblems,
  type InflammationPreview,
} from "../sim/battle/resolve";
import { pathogenKind } from "../sim/pathogens";
import {
  entityAt,
  infoFor,
  sameRef,
  swarmStatuses,
  type InfoCard,
  type InfoRef,
  type SwarmStatus,
} from "./info";
import { createPlayback, type Playback, type Speed } from "../render/playback";
import type {
  BattleOutcome,
  BattleState,
  ChargeKind,
  Coord,
  Order,
  SimEvent,
  SupportOrder,
  SwarmId,
} from "../sim/types";

export interface OrderUi {
  readonly orders: readonly Order[];
  readonly selected: SwarmId | null;
  /** The charge picked in the side panel, waiting for a target tap. */
  readonly charge: ChargeKind | null;
  /** The queued support order (at most one per turn). */
  readonly support: SupportOrder | null;
}

const NONE: OrderUi = {
  orders: [],
  selected: null,
  charge: null,
  support: null,
};

export const CHARGE_LABEL: Record<ChargeKind, string> = {
  antibacterial: "Antibacterial",
  antifungal: "Antifungal",
  strong: "Strong",
};

/** Legal targets of the picked charge, given the pending swarm orders. */
export function orderSupportTargets(battle: BattleState, ui: OrderUi) {
  return ui.charge ? supportTargets(battle, ui.orders, ui.charge) : [];
}

/** Where a support order lands (its pathogen or swarm), or null if that is gone or hidden. */
export function supportAt(
  battle: BattleState,
  support: SupportOrder,
): Coord | null {
  if (support.target === "pathogen") {
    const p = battle.pathogens.find((q) => q.id === support.pathogenId);
    return p && !p.hidden ? p.at : null;
  }
  return battle.swarms.find((s) => s.id === support.swarmId)?.at ?? null;
}

export function describeSupport(o: SupportOrder): string {
  return o.target === "pathogen"
    ? `${o.charge} -> ${o.pathogenId}`
    : `${o.charge} -> ${o.swarmId} load`;
}

/** A support preview, ready for the HUD. */
export interface SupportCard {
  readonly title: string;
  readonly text: string;
  /** A queued order (otherwise a hover preview). */
  readonly pending: boolean;
  readonly valid: boolean;
}

const INTENT_WORD = {
  grow: "growth",
  spread: "spread",
  spore: "spore",
  stall: "stall",
} as const;

/** What `support` does, in plain words; null if its target does not exist. */
export function supportCardFor(
  battle: BattleState,
  orders: readonly Order[],
  support: SupportOrder,
  pending: boolean,
): SupportCard | null {
  const pv: SupportPreview | null = supportPreview(battle, orders, support);
  if (!pv) return null;
  const kind = pathogenKind(pv.kills.kind);
  const left = `${pv.chargesLeft} ${pv.charge} left after this.`;
  let text: string;
  if (pv.reason !== null) text = `Cannot use: ${pv.reason}.`;
  else if (support.target === "pathogen") {
    const cancel =
      pv.cancels && pv.cancels.type !== "stall"
        ? ` Its planned ${INTENT_WORD[pv.cancels.type]} does not happen.`
        : "";
    text = `Kills it, no dice.${cancel} ${left}`;
  } else {
    const after = pv.loadAfter?.length ?? 0;
    text =
      `Clears ${kind.label} from ${support.swarmId}'s load, no dice. Load ${after}/${PARAMS.loadCap}. ` +
      `Move range ${swarmMoveRange(
        battle,
        battle.swarms.find((s) => s.id === support.swarmId)!,
      )} -> ${pv.moveRangeAfter}. ${left}`;
  }
  return {
    title:
      support.target === "pathogen"
        ? `${CHARGE_LABEL[pv.charge]} dose on ${kind.label} ${support.pathogenId}`
        : `${CHARGE_LABEL[pv.charge]} dose on ${support.swarmId}'s load`,
    text,
    pending,
    valid: pv.reason === null,
  };
}

/** Tiles the selected swarm may be ordered to: legal moves that are not another swarm's tile. */
export function orderOptions(
  battle: BattleState,
  ui: OrderUi,
): readonly Coord[] {
  if (!ui.selected) return [];
  return moveOptions(battle, ui.selected, ui.orders)
    .map((r) => r.at)
    .filter((c) => !battle.swarms.some((s) => sameCoord(s.at, c)));
}

/** Engulf targets for the selected swarm, given the other swarms' pending orders. */
export function orderTargets(
  battle: BattleState,
  ui: OrderUi,
): readonly EngulfTarget[] {
  if (!ui.selected) return [];
  return engulfTargets(battle, ui.selected, ui.orders);
}

const supportTargetAt = (battle: BattleState, ui: OrderUi, at: Coord) =>
  orderSupportTargets(battle, ui).find((t) => sameCoord(t.at, at));

const targetAt = (
  battle: BattleState,
  ui: OrderUi,
  at: Coord,
): EngulfTarget | undefined => {
  const p = battle.pathogens.find((q) => sameCoord(q.at, at));
  return p && orderTargets(battle, ui).find((t) => t.pathogenId === p.id);
};

const swarmAt = (battle: BattleState, at: Coord) =>
  battle.swarms.find((s) => sameCoord(s.at, at));

const wallable = (battle: BattleState, id: SwarmId) =>
  wallOffPreview(battle, id)?.reason === null;

/** Queues wall off for `id`, or clears it if already queued. Does nothing if it cannot wall off. */
export function toggleWallOff(
  battle: BattleState,
  ui: OrderUi,
  id: SwarmId,
): OrderUi {
  if (ui.orders.find((o) => o.swarmId === id)?.type === "wallOff") {
    return { ...ui, orders: clearOrder(ui.orders, id) };
  }
  if (!wallable(battle, id)) return ui;
  return {
    ...ui,
    orders: withOrder(ui.orders, { type: "wallOff", swarmId: id }),
  };
}

/**
 * What a tap on a tile (null = off the board) does:
 * - with a charge picked: a legal target queues the support order (or clears it if already
 *   queued); any other tap puts the charge back and acts as below;
 * - own tile of the selected swarm: queue hold (cancels a move); a second tap on a loaded swarm
 *   turns the hold into wall off, and a third clears it;
 * - an option tile: queue the move, or clear it if that move is already queued;
 * - an engulf target's tile: queue the engulf, or clear it if already queued;
 * - another swarm: select it; anything else: deselect.
 */
export function tapTile(
  battle: BattleState,
  ui: OrderUi,
  at: Coord | null,
): OrderUi {
  if (!at) return { ...ui, selected: null, charge: null };
  if (ui.charge) {
    const t = supportTargetAt(battle, ui, at);
    if (t) {
      const same = JSON.stringify(ui.support) === JSON.stringify(t.order);
      return { ...ui, charge: null, support: same ? null : t.order };
    }
    return tapTile(battle, { ...ui, charge: null }, at);
  }
  const here = swarmAt(battle, at);
  const sel = battle.swarms.find((s) => s.id === ui.selected);
  if (here && here.id === sel?.id) {
    const cur = ui.orders.find((o) => o.swarmId === here.id);
    if (cur?.type === "wallOff") return toggleWallOff(battle, ui, here.id);
    if (cur?.type === "hold" && wallable(battle, here.id)) {
      return toggleWallOff(battle, ui, here.id);
    }
    return {
      ...ui,
      orders: withOrder(ui.orders, { type: "hold", swarmId: here.id }),
    };
  }
  if (here) return { ...ui, selected: here.id };
  const target = sel && targetAt(battle, ui, at);
  if (sel && target) {
    const cur = ui.orders.find((o) => o.swarmId === sel.id);
    if (cur?.type === "engulf" && cur.pathogenId === target.pathogenId) {
      return { ...ui, orders: clearOrder(ui.orders, sel.id) };
    }
    return {
      ...ui,
      orders: withOrder(ui.orders, {
        type: "engulf",
        swarmId: sel.id,
        pathogenId: target.pathogenId,
        from: target.from,
      }),
    };
  }
  if (sel && orderOptions(battle, ui).some((c) => sameCoord(c, at))) {
    const cur = ui.orders.find((o) => o.swarmId === sel.id);
    if (cur?.type === "move" && sameCoord(cur.to, at)) {
      return { ...ui, orders: clearOrder(ui.orders, sel.id) };
    }
    return {
      ...ui,
      orders: withOrder(ui.orders, { type: "move", swarmId: sel.id, to: at }),
    };
  }
  return { ...ui, selected: null };
}

export function clearOrder(
  orders: readonly Order[],
  swarmId: SwarmId,
): Order[] {
  return orders.filter((o) => o.swarmId !== swarmId);
}

/** Next swarm in id order (previous for dir -1); wraps, and starts from the ends when none. */
export function cycleSelection(
  battle: BattleState,
  selected: SwarmId | null,
  dir: 1 | -1 = 1,
): SwarmId | null {
  const ids = battle.swarms.map((s) => s.id).sort();
  if (ids.length === 0) return null;
  const i = selected ? ids.indexOf(selected) : -1;
  if (i < 0) return dir === 1 ? ids[0]! : ids[ids.length - 1]!;
  return ids[(i + dir + ids.length) % ids.length]!;
}

export function describeOrder(o: Order): string {
  switch (o.type) {
    case "move":
      return `${o.swarmId} -> ${xy(o.to)}`;
    case "hold":
      return `${o.swarmId} hold`;
    case "wallOff":
      return `${o.swarmId} wall off`;
    case "engulf":
      return o.from
        ? `${o.swarmId} -> ${xy(o.from)}, engulf ${o.pathogenId}`
        : `${o.swarmId} engulf ${o.pathogenId}`;
  }
}

export interface PendingEntry {
  readonly swarmId: SwarmId;
  readonly text: string;
  readonly hasOrder: boolean;
  readonly selected: boolean;
}

/** One engulf's odds, ready for the HUD. */
export interface OddsEntry {
  readonly swarmId: SwarmId;
  /** Generic label, e.g. "bacteria p2". */
  readonly title: string;
  /** Organism name, for the secondary line and tooltip. */
  readonly organism: string;
  readonly text: string;
  /** 0..1 chance the pathogen dies. */
  readonly killChance: number;
  /** A queued order (otherwise a hover/target preview). */
  readonly pending: boolean;
  readonly valid: boolean;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Odds for engulfing `target` with `swarmId` given `orders`; null if the pair does not exist. */
export function oddsFor(
  battle: BattleState,
  orders: readonly Order[],
  swarmId: SwarmId,
  pathogenId: string,
  from: Coord | null,
  pending: boolean,
): OddsEntry | null {
  const swarm = battle.swarms.find((s) => s.id === swarmId);
  const p = battle.pathogens.find((q) => q.id === pathogenId);
  if (!swarm || !p) return null;
  const pv = engulfPreview(battle, orders, {
    type: "engulf",
    swarmId,
    pathogenId,
    from,
  });
  if (!pv) return null;
  const kind = pathogenKind(p.kind);
  const range = `Move range ${swarmMoveRange(battle, swarm)} -> ${pv.moveRangeIfLoaded}.`;
  let text: string;
  if (pv.reason !== null) text = `Cannot engulf: ${pv.reason}.`;
  else if (pv.outcome === "kills") text = "Kills it.";
  else if (pv.outcome === "loads") {
    text = `Loads ${swarmId} (can't kill it). Residual kill chance ${pct(pv.killChance)}. ${range}`;
  } else {
    text = `Loads ${swarmId} unless the residual kill succeeds. Residual kill chance ${pct(pv.killChance)}. ${range}`;
  }
  return {
    swarmId,
    title: `${kind.label} ${p.id}`,
    organism: kind.organism,
    text,
    killChance: pv.killChance,
    pending,
    valid: pv.reason === null,
  };
}

/** The wall-off card for the selected swarm. */
export interface WallCard extends WallOffPreview {
  readonly swarmId: SwarmId;
  readonly queued: boolean;
}

export type ControllerMode = "plan" | "playback";

export interface ChargeChip {
  readonly charge: ChargeKind;
  readonly label: string;
  readonly count: number;
  readonly selected: boolean;
}

export interface Controller {
  /** The sim state (already the post-turn state during playback). */
  state(): BattleState;
  /** What the board should show: the pre-turn state while a turn plays, else state(). */
  displayState(): BattleState;
  mode(): ControllerMode;
  /** The latest turn's playback (finished ones included); null before the first turn. */
  playback(): Playback | null;
  /** Advances playback by real seconds; back to plan mode when it ends. */
  tick(dtSeconds: number): void;
  skip(): void;
  /** Plays the last turn again from its saved pre-turn state and events. */
  replay(): void;
  canReplay(): boolean;
  speed(): Speed;
  setSpeed(speed: Speed): void;
  /** Skip playback by default (prefers-reduced-motion), with a summary pulse instead. */
  reducedMotion(): boolean;
  setReducedMotion(on: boolean): void;
  /** Events from the most recent resolve, as far as playback has revealed them; empty after a reset. */
  lastEvents(): readonly SimEvent[];
  canEndTurn(): boolean;
  /** The battle has ended (status over); ordering is off. Playback may still be running. */
  over(): boolean;
  /** The grade, once over. */
  outcome(): BattleOutcome | null;
  /** Wall off preview for the selected swarm when it is loaded or has the order queued. */
  wallCard(): WallCard | null;
  /** Queues or clears wall off for the selected swarm. */
  wallOff(): void;
  /** What the pending orders do to inflammation; null with no orders or during playback. */
  forecast(): InflammationPreview | null;
  orders(): readonly Order[];
  selected(): SwarmId | null;
  /** Legal destinations for the selected swarm. */
  options(): readonly Coord[];
  /** Pathogens the selected swarm can engulf, with the tile to engulf from. */
  targets(): readonly EngulfTarget[];
  /** Odds for the hovered target, else the selected swarm's engulf order, else all engulf orders. */
  odds(): OddsEntry[];
  /** One status per swarm, for the order list. */
  statuses(): SwarmStatus[];
  /** Info card for the hovered, else tapped, else selected pathogen or swarm. */
  info(): InfoCard | null;
  /** Pointer tile (null = off the board); only changes the odds and info panels. */
  hover(at: Coord | null): void;
  /** Charges with uses left, as chips; the picked one is marked. */
  charges(): ChargeChip[];
  /** Picks a charge to target (again to put it back). */
  pickCharge(charge: ChargeKind | null): void;
  /** The picked charge has no legal target right now. */
  noTargets(): boolean;
  supportOrder(): SupportOrder | null;
  clearSupport(): void;
  /** Hover preview of a charge target, else the queued support order's preview. */
  supportCard(): SupportCard | null;
  /** Board marks for the picked charge's targets and the queued dose. */
  dose(): { targets: Coord[]; queued: Coord | null };
  /** Telegraph marks as they will resolve with the pending orders. */
  marks(): TelegraphMark[];
  /** Order list plus the selected swarm if it has no order yet. */
  pending(): PendingEntry[];
  /** Why the last End Turn was refused; cleared by any order change. */
  problems(): readonly string[];
  select(id: SwarmId | null): void;
  /** Tab: select the next (or previous) swarm. */
  cycle(dir?: 1 | -1): void;
  tap(at: Coord | null): void;
  clearOrder(id: SwarmId): void;
  /** Resolves with the pending orders, swaps in the new state and plays the turn. */
  endTurn(): void;
  /** Reloads the scenario with the same seed. */
  reset(): void;
}

/** What a played turn needs to be replayed. */
interface PlayedTurn {
  readonly before: BattleState;
  readonly orders: readonly Order[];
  readonly support: SupportOrder | null;
  readonly events: readonly SimEvent[];
  readonly after: BattleState;
}

export function createController(
  load: () => BattleState,
  onChange: (c: Controller) => void,
  options: { reducedMotion?: boolean } = {},
): Controller {
  let state = load();
  let events: readonly SimEvent[] = [];
  let ui: OrderUi = NONE;
  let problems: readonly string[] = [];
  let hovered: Coord | null = null;
  let inspected: InfoRef | null = null;
  let last: PlayedTurn | null = null;
  let pb: Playback | null = null;
  let speed: Speed = 1;
  let reduced = options.reducedMotion ?? false;
  const playing = () => pb !== null && !pb.done;
  const hoverTarget = () =>
    hovered ? targetAt(state, ui, hovered) : undefined;
  const hoverSupport = () =>
    hovered ? supportTargetAt(state, ui, hovered) : undefined;
  const hoverRef = () => (hovered ? entityAt(state, hovered) : null);
  const over = () => battleStatus(state).over;
  const set = (next: OrderUi) => {
    if (playing() || over()) return;
    ui = next;
    problems = [];
    onChange(c);
  };
  const play = (turn: PlayedTurn, instant: boolean) => {
    pb = createPlayback(turn.before, turn.events, turn.after, speed);
    if (instant) pb.skip();
    onChange(c);
  };
  const c: Controller = {
    state: () => state,
    displayState: () => (pb && !pb.done ? pb.displayState() : state),
    mode: () => (playing() ? "playback" : "plan"),
    playback: () => pb,
    tick(dt) {
      if (pb && !pb.done && pb.advance(dt)) onChange(c);
    },
    skip() {
      if (!playing()) return;
      pb!.skip();
      onChange(c);
    },
    replay() {
      if (playing() || !last) return;
      play(last, false);
    },
    canReplay: () => !playing() && last !== null,
    speed: () => speed,
    setSpeed(next) {
      speed = next;
      if (pb) pb.speed = next;
      onChange(c);
    },
    reducedMotion: () => reduced,
    setReducedMotion(on) {
      reduced = on;
      onChange(c);
    },
    lastEvents: () => (pb && !pb.done ? pb.revealed() : events),
    canEndTurn: () => !playing() && !over(),
    over,
    outcome: () => (over() ? gradeOutcome(state) : null),
    wallCard() {
      const id = ui.selected;
      const pv = id ? wallOffPreview(state, id) : null;
      if (!id || !pv || over()) return null;
      const queued = ui.orders.some(
        (o) => o.swarmId === id && o.type === "wallOff",
      );
      return pv.contents.length > 0 || queued
        ? { ...pv, swarmId: id, queued }
        : null;
    },
    wallOff() {
      if (ui.selected) set(toggleWallOff(state, ui, ui.selected));
    },
    forecast: () =>
      playing() || over() || (ui.orders.length === 0 && !ui.support)
        ? null
        : inflammationPreview(state, ui.orders, ui.support),
    orders: () => ui.orders,
    selected: () => ui.selected,
    options: () => orderOptions(state, ui),
    targets: () => orderTargets(state, ui),
    odds() {
      const sel = ui.selected;
      const ht = hoverTarget();
      if (sel && ht) {
        const e = oddsFor(state, ui.orders, sel, ht.pathogenId, ht.from, false);
        return e ? [e] : [];
      }
      const engulfs = ui.orders.flatMap((o) =>
        o.type === "engulf" ? [o] : [],
      );
      const shown = engulfs.some((o) => o.swarmId === sel)
        ? engulfs.filter((o) => o.swarmId === sel)
        : engulfs;
      return shown.flatMap((o) => {
        const e = oddsFor(
          state,
          ui.orders,
          o.swarmId,
          o.pathogenId,
          o.from,
          true,
        );
        return e ? [e] : [];
      });
    },
    charges: () =>
      availableCharges(state).map((charge) => ({
        charge,
        label: CHARGE_LABEL[charge],
        count: state.meds.charges[charge],
        selected: ui.charge === charge,
      })),
    pickCharge(charge) {
      const ok = charge === null || availableCharges(state).includes(charge);
      if (ok) set({ ...ui, charge: ui.charge === charge ? null : charge });
    },
    noTargets: () =>
      ui.charge !== null && orderSupportTargets(state, ui).length === 0,
    supportOrder: () => ui.support,
    clearSupport: () => set({ ...ui, support: null, charge: null }),
    supportCard() {
      if (playing() || over()) return null;
      const ht = hoverSupport();
      if (ht) return supportCardFor(state, ui.orders, ht.order, false);
      return ui.support
        ? supportCardFor(state, ui.orders, ui.support, true)
        : null;
    },
    dose() {
      if (playing() || over()) return { targets: [], queued: null };
      return {
        targets: orderSupportTargets(state, ui).map((t) => t.at),
        queued: ui.support ? supportAt(state, ui.support) : null,
      };
    },
    statuses: () => swarmStatuses(state, ui.orders, ui.selected),
    info() {
      if (playing()) return null;
      const ref =
        hoverRef() ??
        inspected ??
        (ui.selected ? { kind: "swarm" as const, id: ui.selected } : null);
      return ref ? infoFor(state, c.marks(), ref, ui.orders) : null;
    },
    hover(at) {
      if (playing()) return;
      const before = hoverTarget()?.pathogenId;
      const beforeRef = hoverRef();
      const beforeSupport = hoverSupport()?.at;
      hovered = at;
      const nowSupport = hoverSupport()?.at;
      if (
        nowSupport?.x !== beforeSupport?.x ||
        nowSupport?.y !== beforeSupport?.y ||
        hoverTarget()?.pathogenId !== before ||
        !sameRef(hoverRef(), beforeRef)
      ) {
        onChange(c);
      }
    },
    marks: () =>
      playing() && last
        ? telegraph(last.before, last.orders, last.support)
        : telegraph(state, ui.orders, ui.support),
    pending() {
      const list = ui.orders.map((o) => ({
        swarmId: o.swarmId,
        text: describeOrder(o),
        hasOrder: true,
        selected: o.swarmId === ui.selected,
      }));
      if (ui.selected && !ui.orders.some((o) => o.swarmId === ui.selected)) {
        list.push({
          swarmId: ui.selected,
          text: `${ui.selected} (no order)`,
          hasOrder: false,
          selected: true,
        });
      }
      return list;
    },
    problems: () => problems,
    select: (id) => set({ ...ui, selected: id, charge: null }),
    cycle: (dir = 1) =>
      set({
        ...ui,
        selected: cycleSelection(state, ui.selected, dir),
        charge: null,
      }),
    tap(at) {
      if (!playing()) inspected = at ? entityAt(state, at) : null;
      set(tapTile(state, ui, at));
    },
    clearOrder: (id) => set({ ...ui, orders: clearOrder(ui.orders, id) }),
    endTurn() {
      if (!c.canEndTurn()) return;
      const found = turnProblems(state, ui.orders, ui.support);
      if (found.length > 0) {
        problems = found;
        onChange(c);
        return;
      }
      const before = state;
      const r = resolveTurn(state, ui.orders, ui.support);
      last = {
        before,
        orders: ui.orders,
        support: ui.support,
        events: r.events,
        after: r.state,
      };
      state = r.state;
      events = r.events;
      ui = NONE;
      problems = [];
      hovered = null;
      inspected = null;
      play(last, reduced);
    },
    reset() {
      state = load();
      events = [];
      ui = NONE;
      problems = [];
      inspected = null;
      last = null;
      pb = null;
      onChange(c);
    },
  };
  return c;
}

const xy = (c: Coord) => `${c.x},${c.y}`;

/** Log lines for a turn's events; per-tile inflammation changes are shown on the board instead. */
export function logLines(events: readonly SimEvent[]): string[] {
  return events
    .filter((e) => e.type !== "InflammationChanged")
    .map(describeEvent);
}

export function describeEvent(e: SimEvent): string {
  switch (e.type) {
    case "Grew":
      return `${e.pathogenId} grew to ${e.size}`;
    case "Spread":
      return `${e.pathogenId} spread to ${xy(e.to)} (${e.newPathogenId})`;
    case "Spored":
      return `${e.pathogenId} spored to ${xy(e.to)} (${e.newPathogenId})`;
    case "Blocked":
      return `${e.pathogenId} ${e.intent} blocked at ${xy(e.at)} by ${e.swarmId}`;
    case "TissueDamaged":
      return `tissue -${e.amount} (${e.tissueHealth})`;
    case "SwarmMoved":
      return `${e.swarmId} moved to ${xy(e.path[e.path.length - 1]!)}`;
    case "Engulfed":
      return `${e.swarmId} engulfed ${e.pathogenId} (${e.wall})`;
    case "Killed":
      return e.cause === "charge"
        ? `${e.pathogenId} killed by a charge at ${xy(e.at)}`
        : `${e.pathogenId} killed at ${xy(e.at)}`;
    case "SupportUsed":
      return e.target === "pathogen"
        ? `${e.charge} charge used on ${e.pathogenId}`
        : `${e.charge} charge used on ${e.swarmId}'s load`;
    case "Revealed":
      return `${e.swarmId} revealed a hidden ${pathogenKind(e.kind).label} ${e.pathogenId} (size ${e.size}) at ${xy(e.at)}`;
    case "ResidualKill":
      return `${e.swarmId} residual kill: ${e.success ? "succeeded" : "failed"} (${pct(e.chance)})`;
    case "Walled":
      return `${e.swarmId} walled off a granuloma at ${xy(e.at)}`;
    case "Loaded":
      return `${e.swarmId} loaded (${e.load.length}/${PARAMS.loadCap})`;
    default:
      return "Something happened";
  }
}
