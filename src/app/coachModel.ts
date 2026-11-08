import { availableCharges } from "../sim/battle/support";
import { organismList, organismName } from "../sim/organisms";
import { wallOf } from "../sim/pathogens";
import type { BattleState, ChargeKind, SimEvent } from "../sim/types";
import { incomingKey } from "./arrivalModel";
import {
  CHARGE_LABEL,
  orderSupportTargets,
  orderTargets,
  type OrderUi,
} from "./controller";
import type { TutorialPart } from "./tutorialModel";

// The pure side of Arc 1's coach marks (arc1-tutorial-design.md, section 4): which one-line mark to
// show, if any, and what has been finished or retired. The strip that draws it is T5.

/** The rows of the design's table 4.2. A2 and A2b are one mark with two texts, so A2b has no id. */
export type CoachId =
  | "A1"
  | "A2"
  | "A3"
  | "A4"
  | "A5"
  | "A5b"
  | "B1"
  | "B2"
  | "B2b"
  | "B3"
  | "B4"
  | "B5";

/** A control the strip should outline: End Turn, or a charge chip. */
export type CoachTarget = "endTurn" | ChargeKind;

export interface CoachMark {
  readonly id: CoachId;
  readonly text: string;
  readonly target?: CoachTarget;
}

/** What the strip remembers during one play of Arc 1 (nothing is stored between plays). */
export interface CoachState {
  /** Finished, dismissed with "Got it" or retired: these never come back. */
  readonly done: readonly CoachId[];
  /** The turn each mark first showed on, for the retire rule. */
  readonly shownOn: Readonly<Partial<Record<CoachId, number>>>;
  /** A shelled germ has been swallowed in this play. */
  readonly swallowed: boolean;
}

export const START_COACH: CoachState = {
  done: [],
  shownOn: {},
  swallowed: false,
};

/** A mark that is ignored retires after this many turns on screen. */
export const RETIRE_AFTER_TURNS = 2;

/** Marks only show while the player is planning; they are hidden during playback and when over. */
export type CoachMode = "planning" | "playback" | "over";

export interface CoachInput {
  readonly part: TutorialPart;
  readonly battle: BattleState;
  /** Pending orders, the selection and the picked or queued charge. */
  readonly ui: OrderUi;
  readonly mode: CoachMode;
  /** The events of the last playback (empty before the first turn ends). */
  readonly events: readonly SimEvent[];
  /** "Tap" on a coarse pointer, "Click" otherwise. */
  readonly pointer: "tap" | "click";
}

/** The mode for the strip: planning only when a turn is not playing and the fight is not over. */
export const coachMode = (playing: boolean, over: boolean): CoachMode =>
  playing ? "playback" : over ? "over" : "planning";

const swallowedShelled = (events: readonly SimEvent[]) =>
  events.some((e) => e.type === "Engulfed" && e.wall === "sealed");

const killed = (events: readonly SimEvent[]) =>
  events.some((e) => e.type === "Killed");

const hasOrder = (i: CoachInput) =>
  i.ui.orders.length > 0 || i.ui.support !== null;

const verb = (i: CoachInput) => (i.pointer === "tap" ? "Tap" : "Click");

const isDone = (state: CoachState, id: CoachId) => state.done.includes(id);

/** The first row whose condition holds and that is not finished, in the design's priority order. */
export function coachMark(state: CoachState, i: CoachInput): CoachMark | null {
  if (i.mode !== "planning") return null;
  const rules = i.part === "a" ? RULES_A : RULES_B;
  for (const rule of rules) {
    const mark = rule(state, i);
    if (mark && !isDone(state, mark.id)) return mark;
  }
  return null;
}

type Rule = (state: CoachState, i: CoachInput) => CoachMark | null;

const RULES_A: readonly Rule[] = [
  // A1: part A starts, until a swarm is picked.
  (_s, i) => ({
    id: "A1",
    text: `These are your cells, in swarms. ${verb(i)} one to pick it.`,
  }),
  // A2 and A2b: a picked swarm with no order yet.
  (_s, i) => {
    const sel = i.ui.selected;
    if (!sel || i.ui.orders.some((o) => o.swarmId === sel)) return null;
    const targets = orderTargets(i.battle, i.ui);
    if (targets.length === 0)
      return {
        id: "A2",
        text: `The bright tiles show where it can go. ${verb(i)} one to move closer.`,
      };
    // An easy kill first: name a germ without a shell if there is one in reach.
    const kind = i.battle.pathogens.find(
      (p) =>
        wallOf(p) === "leaky" && targets.some((t) => t.pathogenId === p.id),
    )?.kind;
    const name = organismName(
      kind ??
        i.battle.pathogens.find((p) =>
          targets.some((t) => t.pathogenId === p.id),
        )!.kind,
    );
    return { id: "A2", text: `${verb(i)} the ${name} to swallow it.` };
  },
  // A3: an order is queued and the turn has not ended.
  (_s, i) =>
    hasOrder(i)
      ? {
          id: "A3",
          text: "Give the others orders too, or press End Turn. Everything moves at once.",
          target: "endTurn",
        }
      : null,
  // A5: right after a playback in which a shelled germ was swallowed.
  (_s, i) =>
    swallowedShelled(i.events)
      ? {
          id: "A5",
          text: "Swallowed, but not finished. Its shell keeps it alive inside your cells.",
        }
      : null,
  // A4: turn 2 planning.
  (_s, i) =>
    i.battle.turn === 2
      ? {
          id: "A4",
          text: `${killed(i.events) ? "Nice, your cells finished it. " : ""}The arrows show what each germ will do next turn.`,
        }
      : null,
  // A5b: turn 3 and on, if nothing shelled has been swallowed yet.
  (s, i) => {
    if (i.battle.turn < 3 || seenSwallowed(s, i)) return null;
    const shelled = [
      ...new Set(
        i.battle.pathogens
          .filter((p) => wallOf(p) === "sealed")
          .map((p) => p.kind),
      ),
    ];
    return shelled.length === 0
      ? null
      : {
          id: "A5b",
          text: `The ${organismList(shelled)} has a shell. Try swallowing it and see what happens.`,
        };
  },
];

const RULES_B: readonly Rule[] = [
  // B2b: the antifungal charge is picked.
  (_s, i) => {
    if (i.ui.charge !== "antifungal") return null;
    const kinds = orderSupportTargets(i.battle, i.ui).flatMap(({ order }) => {
      if (order.target === "pathogen")
        return i.battle.pathogens
          .filter((p) => p.id === order.pathogenId)
          .map((p) => p.kind);
      return (
        i.battle.swarms
          .find((sw) => sw.id === order.swarmId)
          ?.load.map((c) => c.kind) ?? []
      );
    });
    if (kinds.length === 0) return null;
    return {
      id: "B2b",
      text: `Now ${verb(i).toLowerCase()} the green diamond on the ${organismList([...new Set(kinds)])}.`,
    };
  },
  // B1: part B starts.
  () => ({
    id: "B1",
    text: "Now you take medicine every day. The green glow is your medicine, slowing germs down.",
  }),
  // B2: a charge is available and none is picked yet.
  (_s, i) => {
    if (i.ui.charge !== null || i.ui.support !== null) return null;
    const have = availableCharges(i.battle);
    if (have.length === 0) return null;
    const charge = have.includes("antifungal") ? "antifungal" : have[0]!;
    return {
      id: "B2",
      text: `Your medicine also gives you charges. ${verb(i)} ${CHARGE_LABEL[charge]}.`,
      target: charge,
    };
  },
  // B3: a stall mark on the board.
  (_s, i) =>
    i.battle.intents.some((x) => x.type === "stall")
      ? {
          id: "B3",
          text: "See the green pause sign? Your medicine is holding that germ back this turn.",
        }
      : null,
  // B4: an incoming ring on the board.
  (_s, i) =>
    incomingKey(i.battle).incoming
      ? {
          id: "B4",
          text: "A ring at the edge means more germs are coming. A swarm standing on it meets them there.",
        }
      : null,
  // B5: right after a playback in which a shelled germ was swallowed.
  (_s, i) =>
    swallowedShelled(i.events)
      ? {
          id: "B5",
          text: "Swallowed. With your medicine, your cells have a better chance to finish it each turn.",
        }
      : null,
];

/** A shelled germ has been swallowed: seen in an earlier playback, this one, or a swarm's load now. */
const seenSwallowed = (state: CoachState, i: CoachInput) =>
  state.swallowed ||
  swallowedShelled(i.events) ||
  i.battle.swarms.some((s) => s.load.length > 0);

/** True when what a mark asks for has happened. `since` is the turn the mark first showed on. */
function finished(
  id: CoachId,
  state: CoachState,
  i: CoachInput,
  since: number,
): boolean {
  switch (id) {
    case "A1":
      return i.ui.selected !== null || hasOrder(i);
    case "A2":
    case "A4":
    case "A5":
    case "B5":
      return hasOrder(i);
    case "A5b":
      return seenSwallowed(state, i);
    case "B1":
      return i.ui.selected !== null;
    case "B2":
      return i.ui.charge !== null || i.ui.support !== null;
    case "B2b":
      return i.ui.support !== null;
    case "A3":
    case "B3":
    case "B4":
      return i.battle.turn > since;
  }
}

/**
 * The state after the input changed (call it after every order, selection or charge change, and
 * when a turn starts). Finished marks and marks that have been on screen for two turns become done
 * for good; the mark now showing, if new, records the turn it showed on. Ending a turn with no
 * orders satisfies A3 too, so it never shows after turn 1.
 */
export function advanceCoach(state: CoachState, i: CoachInput): CoachState {
  let next: CoachState = {
    ...state,
    swallowed: seenSwallowed(state, i),
  };
  const done = new Set(next.done);
  if (i.part === "a" && i.battle.turn > 1) done.add("A3");
  for (const [key, since] of Object.entries(next.shownOn)) {
    const id = key as CoachId;
    if (done.has(id)) continue;
    if (
      finished(id, next, i, since) ||
      i.battle.turn - since >= RETIRE_AFTER_TURNS
    )
      done.add(id);
  }
  next = { ...next, done: [...done] };
  const mark = coachMark(next, i);
  if (!mark) return next;
  const first = next.shownOn[mark.id];
  // A restarted fight begins at turn 1 again: count its turns afresh.
  if (first !== undefined && first <= i.battle.turn) return next;
  return {
    ...next,
    shownOn: { ...next.shownOn, [mark.id]: i.battle.turn },
  };
}

/** "Got it": the mark is finished for this play. */
export function dismissCoach(state: CoachState, id: CoachId): CoachState {
  return state.done.includes(id)
    ? state
    : { ...state, done: [...state.done, id] };
}
