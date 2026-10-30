import { distance, sameCoord } from "../board";
import { PARAMS } from "../params";
import { wallOf } from "../pathogens";
import { rngFromSeed, rngInt, type RngState } from "../rng";
import type {
  BattleOutcome,
  BattleState,
  Coord,
  Order,
  Pathogen,
  SupportOrder,
  Swarm,
} from "../types";
import { telegraph } from "./intents";
import { engulfTargets, moveOptions, orderProblems } from "./orders";
import { battleStatus, gradeOutcome } from "./outcome";
import { resolveTurn, turnProblems } from "./resolve";
import { availableCharges, chargeCovers, supportTargets } from "./support";

// Headless players for balance checks. Each one picks one order per swarm, in swarm order,
// seeing the orders already picked this turn. They are deliberately simple.

export interface BotTurn {
  readonly battle: BattleState;
  readonly swarm: Swarm;
  readonly orders: readonly Order[];
  readonly rng: { state: RngState };
}

export type Bot = (turn: BotTurn) => Order | null;

const visible = (b: BattleState) => b.pathogens.filter((p) => !p.hidden);

/** Where a swarm will stand once `orders` resolve. */
function endOf(s: Swarm, orders: readonly Order[]): Coord {
  const o = orders.find((q) => q.swarmId === s.id);
  if (o?.type === "move") return o.to;
  if (o?.type === "engulf" && o.from) return o.from;
  return s.at;
}

/**
 * The legal move that gets closest to `goal`; null if none gets closer than where it stands. With
 * `avoidCrowd`, tiles touching another swarm's end tile are skipped.
 */
function toward(t: BotTurn, goal: Coord, avoidCrowd = false): Order | null {
  const ends = t.battle.swarms
    .filter((s) => s.id !== t.swarm.id)
    .map((s) => endOf(s, t.orders));
  const crowded = (c: Coord) =>
    avoidCrowd &&
    ends.some((e) => Math.abs(e.x - c.x) <= 1 && Math.abs(e.y - c.y) <= 1);
  let best: Coord | null = null;
  let bestD = distance(t.swarm.at, goal);
  for (const r of moveOptions(t.battle, t.swarm.id, t.orders)) {
    if (crowded(r.at)) continue;
    const d = distance(r.at, goal);
    if (d < bestD) {
      best = r.at;
      bestD = d;
    }
  }
  return best ? { type: "move", swarmId: t.swarm.id, to: best } : null;
}

function nearest(from: Coord, ps: readonly Pathogen[]): Pathogen | null {
  return (
    [...ps].sort((a, b) => distance(from, a.at) - distance(from, b.at))[0] ??
    null
  );
}

/** An engulf on the first target `ok` accepts, leaky ones first. */
function engulfIf(t: BotTurn, ok: (p: Pathogen) => boolean): Order | null {
  const targets = engulfTargets(t.battle, t.swarm.id, t.orders)
    .map((e) => ({
      e,
      p: t.battle.pathogens.find((q) => q.id === e.pathogenId) as Pathogen,
    }))
    .filter(({ p }) => ok(p))
    .sort(
      (a, b) =>
        (wallOf(a.p) === "leaky" ? 0 : 1) - (wallOf(b.p) === "leaky" ? 0 : 1),
    );
  const first = targets[0];
  return first
    ? {
        type: "engulf",
        swarmId: t.swarm.id,
        pathogenId: first.p.id,
        from: first.e.from,
      }
    : null;
}

const full = (s: Swarm) => s.load.length >= PARAMS.loadCap;
const canTake = (s: Swarm) => (p: Pathogen) =>
  wallOf(p) === "leaky" || !full(s);

/**
 * Telegraphed spread or spore targets that will land with the orders picked so far, except from
 * pathogens `skip` accepts.
 */
function landingTargets(
  t: BotTurn,
  skip: (p: Pathogen) => boolean = () => false,
): Coord[] {
  return telegraph(t.battle, t.orders).flatMap((m) => {
    const p = t.battle.pathogens.find((q) => q.id === m.pathogenId);
    return m.to && !m.blockedBy && !m.cancelledBy && p && !skip(p)
      ? [m.to]
      : [];
  });
}

const wallOff = (t: BotTurn): Order => ({
  type: "wallOff",
  swarmId: t.swarm.id,
});

function carefulPlay(
  t: BotTurn,
  leave: (p: Pathogen) => boolean,
): Order | null {
  if (t.swarm.busyTurns > 0) return null;
  const leaky = engulfIf(t, (p) => wallOf(p) === "leaky");
  if (leaky) return leaky;
  const reach = moveOptions(t.battle, t.swarm.id, t.orders);
  const block = landingTargets(t, leave).find((to) =>
    reach.some((r) => sameCoord(r.at, to)),
  );
  if (block) return { type: "move", swarmId: t.swarm.id, to: block };
  if (full(t.swarm)) return wallOff(t);
  const sealed = engulfIf(t, (p) => t.swarm.load.length === 0 && !leave(p));
  if (sealed) return sealed;
  const goal = nearest(
    t.swarm.at,
    visible(t.battle).filter((p) => canTake(t.swarm)(p) && !leave(p)),
  );
  return goal ? (toward(t, goal.at, true) ?? toward(t, goal.at)) : null;
}

export const BOTS: Record<string, Bot> = {
  /** Never orders anything. */
  hold: () => null,

  /** Engulfs anything it can reach, else walks to the nearest pathogen it could take. */
  engulfAll: (t) =>
    engulfIf(t, canTake(t.swarm)) ??
    toward(
      t,
      nearest(t.swarm.at, visible(t.battle).filter(canTake(t.swarm)))?.at ??
        t.swarm.at,
    ),

  /** Engulfs sealed pathogens before leaky ones, so carried loads get longer to die. */
  sealedFirst: (t) => {
    const targets = engulfTargets(t.battle, t.swarm.id, t.orders);
    const sealed = targets.find((e) => e.wall === "sealed" && !full(t.swarm));
    if (sealed) {
      return {
        type: "engulf",
        swarmId: t.swarm.id,
        pathogenId: sealed.pathogenId,
        from: sealed.from,
      };
    }
    return BOTS.engulfAll(t);
  },

  /** Kills leaky pathogens and ignores sealed ones. */
  leakyOnly: (t) =>
    engulfIf(t, (p) => wallOf(p) === "leaky") ??
    toward(
      t,
      nearest(
        t.swarm.at,
        visible(t.battle).filter((p) => wallOf(p) === "leaky"),
      )?.at ?? t.swarm.at,
    ),

  /** engulfAll, but walls off any load as soon as it has one. */
  wallAtOnce: (t) =>
    t.swarm.load.length > 0 && t.swarm.busyTurns === 0
      ? wallOff(t)
      : BOTS.engulfAll(t),

  /** engulfAll, but walls off a loaded swarm that has nothing to engulf this turn. */
  wallIdle: (t) => {
    if (t.swarm.load.length === 0 || t.swarm.busyTurns > 0) {
      return BOTS.engulfAll(t);
    }
    return engulfIf(t, canTake(t.swarm)) ?? wallOff(t);
  },

  /** engulfAll, but walls off a full swarm. */
  wallWhenFull: (t) =>
    full(t.swarm) && t.swarm.busyTurns === 0 ? wallOff(t) : BOTS.engulfAll(t),

  /**
   * A careful player: kill leaky, stand on any spread or spore about to land, take a sealed one
   * only with an empty swarm, wall off a full swarm, and keep swarms apart when just walking.
   */
  careful: (t) => carefulPlay(t, () => false),

  /**
   * careful, but leaves a sealed pathogen to the charges while one that works on it is left
   * ("wait and kill it with the charge"). Pair it with a support bot that spends them.
   */
  saveForCharge: (t) =>
    carefulPlay(
      t,
      (p) =>
        wallOf(p) === "sealed" &&
        availableCharges(t.battle).some((c) => chargeCovers(c, p.kind)),
    ),

  /** A random legal order (or nothing) per swarm. */
  random: (t) => {
    const options: Order[] = [
      ...engulfTargets(t.battle, t.swarm.id, t.orders).map((e): Order => ({
        type: "engulf",
        swarmId: t.swarm.id,
        pathogenId: e.pathogenId,
        from: e.from,
      })),
      ...moveOptions(t.battle, t.swarm.id, t.orders).map((r): Order => ({
        type: "move",
        swarmId: t.swarm.id,
        to: r.at,
      })),
    ];
    if (t.swarm.load.length > 0) options.push(wallOff(t));
    const pick = rngInt(t.rng.state, options.length + 1);
    t.rng.state = pick.rng;
    return options[pick.value] ?? null;
  },
};

/** Picks the turn's support charge (or none) once the swarm orders are chosen. */
export type SupportBot = (
  battle: BattleState,
  orders: readonly Order[],
) => SupportOrder | null;

/**
 * The legal charge use that removes the biggest threat: size, plus 2 if sealed, plus 2 if its
 * spread or spore is about to land; a carried load scores 1 + the swarm's load. Strong charges
 * prefer sealed targets. Ties keep supportTargets order.
 */
function bestSupport(
  battle: BattleState,
  orders: readonly Order[],
): SupportOrder | null {
  const marks = telegraph(battle, orders);
  const score = (order: SupportOrder): number => {
    if (order.target === "load") {
      const s = battle.swarms.find((q) => q.id === order.swarmId) as Swarm;
      return 1 + s.load.length;
    }
    const p = battle.pathogens.find(
      (q) => q.id === order.pathogenId,
    ) as Pathogen;
    const m = marks.find((q) => q.pathogenId === p.id);
    const landing = m?.to && !m.blockedBy && !m.cancelledBy ? 2 : 0;
    const sealed = wallOf(p) === "sealed" ? 2 : 0;
    const waste = order.charge === "strong" && !sealed ? -1 : 0;
    return p.size + sealed + landing + waste;
  };
  let best: SupportOrder | null = null;
  for (const charge of availableCharges(battle)) {
    for (const { order } of supportTargets(battle, orders, charge)) {
      if (!best || score(order) > score(best)) best = order;
    }
  }
  return best;
}

export const SUPPORT_BOTS: Record<string, SupportBot> = {
  /** Never spends a charge. */
  none: () => null,
  /** Spends a charge every turn it can, on the biggest threat. */
  eager: bestSupport,
};

/**
 * Plays a battle to the end with `bot` for the swarms and `support` for the charges, and grades
 * it. `seed` drives the random bot only.
 */
export function playBattle(
  bot: Bot,
  start: BattleState,
  seed: number,
  support: SupportBot = SUPPORT_BOTS.none,
): { outcome: BattleOutcome; final: BattleState } {
  let battle = start;
  const rng = { state: rngFromSeed(seed * 7919 + 1) };
  while (!battleStatus(battle).over) {
    let orders: Order[] = [];
    for (const swarm of battle.swarms) {
      const order = bot({ battle, swarm, orders, rng });
      if (!order) continue;
      const next = [...orders, order];
      if (orderProblems(battle, next).length === 0) orders = next;
    }
    const charge = support(battle, orders);
    const used =
      charge && turnProblems(battle, orders, charge).length === 0
        ? charge
        : null;
    battle = resolveTurn(battle, orders, used).state;
  }
  return { outcome: gradeOutcome(battle), final: battle };
}
