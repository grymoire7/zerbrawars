import { medLevelOf } from "../sim/life/meds";
import { exposurePreview } from "../sim/life/preview";
import { plannedChoices } from "../sim/score";
import type { MedCharges } from "../sim/types";
import type { StatusCell, StatusModel } from "../ui/statusStrip";
import {
  energyPlan,
  findPlaced,
  medForecast,
  placementProblems,
  unplaceCard,
} from "../sim/life/calendar";
import { cardDef } from "../sim/life/cards";
import type {
  BattleReason,
  CardId,
  LifeEvent,
  LifeState,
} from "../sim/life/types";
import type { BattleKind } from "../sim/types";
import { bodyBeats } from "./campaignModel";
import { PARAMS } from "../sim/params";
import { pathogenKind, type PathogenKindId } from "../sim/pathogens";

// Pure helpers that turn life-phase state into plain words and numbers for the calendar UI and
// the body inset. Nothing here touches the DOM or three.js.

const L = PARAMS.life;
const EVENING = L.slotsPerDay - 1;

export const slotName = (slot: number) =>
  slot === EVENING ? "Evening" : "Daytime";

export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "mold" or "bacterial": the silhouette family a pathogen is drawn as, as an adjective. */
export const kindNoun = (kind: PathogenKindId) =>
  pathogenKind(kind).form === "mold" ? "mold" : "bacterial";

/** Honest odds in words, e.g. "45% chance of a mold exposure". */
export function oddsText(chance: number, kind: PathogenKindId): string {
  return `${Math.round(chance * 100)}% chance of a ${kindNoun(kind)} exposure`;
}

const MAX_PARTICLES = 40;
const PARTICLES_PER_PATHOGEN = 30;

/** Preview dots for a card: proportional to the pathogens it brings on average, never 0 if risky. */
export function particleCount(expectedPathogens: number): number {
  if (expectedPathogens <= 0) return 0;
  return Math.min(
    MAX_PARTICLES,
    Math.max(1, Math.round(expectedPathogens * PARTICLES_PER_PATHOGEN)),
  );
}

/** Sim wording to warm, plain wording. Unknown messages pass through. */
export function friendlyProblem(problem: string): string {
  if (problem === "not enough energy") return "Not enough energy for this";
  if (problem === "that day is over") return "That day is already played";
  if (problem === "the week is over") return "The week is over";
  if (problem.startsWith("a sleepover needs"))
    return "A sleepover needs an evening with a day after it";
  const done = /is already on day (\d+)/.exec(problem);
  if (done) return `Already planned for day ${Number(done[1]) + 1}`;
  return problem;
}

export interface PlacementCheck {
  readonly day: number;
  readonly slot: number;
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

/**
 * Whether `card` can go in this slot. A card already on a future slot moves (the old spot is
 * cleared first), so only a played card or a real conflict blocks it.
 */
export function placementCheck(
  life: LifeState,
  day: number,
  slot: number,
  card: CardId,
  packPills: boolean,
): PlacementCheck {
  const at = findPlaced(life, card);
  const base =
    at && (at.day !== day || at.slot !== slot) && at.day >= life.day
      ? unplaceCard(life, at.day, at.slot).state
      : life;
  const reasons = placementProblems(base, day, slot, card, packPills).map(
    friendlyProblem,
  );
  return { day, slot, ok: reasons.length === 0, reasons };
}

export interface DoseCell {
  readonly day: number;
  readonly taken: boolean;
  /** Already decided (tapped, skipped, defaulted or lost) rather than a forecast. */
  readonly decided: boolean;
  readonly level: number;
  /** The state in plain words: "taken", "skipped" or why the dose is lost. */
  readonly why: string;
  /** True when tapping the chip flips the dose: the day is not played and not locked. */
  readonly toggle: boolean;
}

const WHY = {
  tapped: "taken",
  default: "taken",
  skipped: "skipped",
  friction: "pills in the other bag",
} as const;

/** Every day of the week: the dose as it stands (or is forecast) and the med level after it. */
export function doseStrip(life: LifeState): DoseCell[] {
  const cells: DoseCell[] = [];
  for (let day = 0; day < Math.min(life.day, L.days); day++) {
    const i = life.doses.findIndex(
      (d) => d.week === life.week && d.day === day,
    );
    if (i < 0) continue;
    const d = life.doses[i];
    cells.push({
      day,
      taken: d.taken,
      decided: true,
      level: medLevelOf(life.doses.slice(0, i + 1)),
      why: WHY[d.cause],
      toggle: false,
    });
  }
  if (life.day < L.days) {
    for (const f of medForecast(life)) {
      const decided = life.doses.some(
        (d) => d.week === life.week && d.day === f.day,
      );
      cells.push({
        day: f.day,
        taken: f.taken,
        decided,
        level: f.level,
        why: WHY[f.cause],
        toggle: f.cause !== "friction",
      });
    }
  }
  return cells;
}

const labelOf = (card: CardId) => cardDef(card).label;

/** The day's events as short plain-language beats. */
export function lifeBeats(events: readonly LifeEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case "MedsTaken":
        out.push(
          e.cause === "tapped"
            ? `Meds taken. Streak: ${e.streak}.`
            : `Meds counted as taken. Streak: ${e.streak}.`,
        );
        break;
      case "MedsSkipped":
        out.push(
          e.cause === "friction"
            ? "That dose is missed."
            : "You skipped today's meds.",
        );
        break;
      case "CardPlayed":
        out.push(`${labelOf(e.card)}.`);
        break;
      case "GoalPoints":
        out.push(`+${e.points} toward the goal (${e.total} of ${e.target}).`);
        break;
      case "Rested":
        out.push("You took a breather and got some energy back.");
        break;
      case "ExposureRolled":
        out.push(
          e.landed
            ? `A ${kindNoun(e.kind)} exposure landed (it was a ${pct(e.chance)} chance).`
            : `No ${kindNoun(e.kind)} exposure this time (${pct(e.chance)} chance).`,
        );
        break;
      case "FrictionEvent":
        out.push(
          "Morning after the sleepover: the pills are in the other bag.",
        );
        break;
      case "MedLevelChanged":
        out.push(
          e.to < e.from
            ? `Medication level fell from ${pct(e.from)} to ${pct(e.to)}.`
            : `Medication level rose from ${pct(e.from)} to ${pct(e.to)}.`,
        );
        break;
      case "WeekEnded":
        out.push("The week is over.");
        break;
      default:
        out.push(...bodyBeats([e]));
        break;
    }
  }
  return out;
}

/**
 * Whether "Play the week" stops after a day that produced these events. It stops where the player
 * has something to decide on the new morning: a symptom showed (book the doctor) or the sleepover's
 * missed dose. It also stops when the week ends. The first day pressed is always played.
 */
export function weekPlayStops(events: readonly LifeEvent[]): boolean {
  return events.some(
    (e) =>
      e.type === "SymptomAppeared" ||
      e.type === "FrictionEvent" ||
      e.type === "WeekEnded",
  );
}

export interface StopBanner {
  readonly kind: "symptom" | "friction";
  /** 1-based day number the event belongs to, as the player sees it. */
  readonly day: number;
  /** Plain names of the symptoms that showed ("a low fever"); empty for friction. */
  readonly symptoms: readonly string[];
  readonly text: string;
}

const SYMPTOM_NAME: Record<string, string> = {
  lowFever: "a low fever",
  soreSpot: "a sore spot",
  tired: "tiredness",
};

const joinWords = (xs: readonly string[]) =>
  xs.length <= 1
    ? (xs[0] ?? "")
    : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;

/**
 * Why "Play the week" stopped, in words, from the events of the day just played. A symptom wins
 * over the missed dose; null when nothing but the week's end stopped it. `canBook` says the
 * doctor card is still free to place, which decides whether the text offers it.
 */
export function stopBanner(
  events: readonly LifeEvent[],
  canBook: boolean,
): StopBanner | null {
  const shown = events.flatMap((e) =>
    e.type === "SymptomAppeared" ? [e.symptom] : [],
  );
  if (shown.length > 0) {
    const day = shown[0].day + 1;
    const names = shown.map((s) => SYMPTOM_NAME[s.kind] ?? s.kind);
    const said = joinWords(names);
    const lead = `${said.charAt(0).toUpperCase()}${said.slice(1)} showed up on Day ${day}.`;
    return {
      kind: "symptom",
      day,
      symptoms: names,
      text: canBook
        ? `${lead} You can book the doctor now, or play on for now.`
        : lead,
    };
  }
  for (const e of events) {
    if (e.type === "FrictionEvent") {
      const day = e.day + 1;
      return {
        kind: "friction",
        day,
        symptoms: [],
        text: `Day ${day}: your pills stayed at Sam's, so Day ${day}'s dose is missed.`,
      };
    }
  }
  return null;
}

/** The earliest empty slot from today on where the doctor card is allowed, or null. */
export function earliestDoctorSlot(
  life: LifeState,
): { day: number; slot: number } | null {
  for (let day = life.day; day < L.days; day++) {
    for (let slot = 0; slot < L.slotsPerDay; slot++) {
      if (
        !life.plan[day][slot] &&
        placementProblems(life, day, slot, "doctor").length === 0
      )
        return { day, slot };
    }
  }
  return null;
}

export interface WeekSummary {
  readonly landed: readonly { readonly text: string }[];
  readonly dodged: number;
  readonly medLevel: number;
  readonly streak: number;
  readonly points: number;
  readonly target: number;
  readonly metGoal: boolean;
}

/** What the week came to, for the end-of-week card. */
export function weekSummary(life: LifeState): WeekSummary {
  const groups = new Map<string, { card: CardId; kind: string; n: number }>();
  for (const x of life.exposures) {
    const key = `${x.day}:${x.slot}`;
    const g = groups.get(key) ?? { card: x.card, kind: kindNoun(x.kind), n: 0 };
    g.n += 1;
    groups.set(key, g);
  }
  return {
    landed: [...groups.values()].map((g) => ({
      text: `${labelOf(g.card)}: ${g.n} ${g.kind} exposure${g.n > 1 ? "s" : ""}`,
    })),
    dodged: life.rolls.filter((r) => !r.landed).length,
    medLevel: life.medLevel,
    streak: life.streak,
    points: life.goal.points,
    target: life.goal.target,
    metGoal: life.goal.points >= life.goal.target,
  };
}

// ---- Pending pick: an activity and a time slot, chosen in either order. ----

export type PickedActivity = string; // an activity's base id, or "rest"

export interface Pending {
  readonly activity: PickedActivity | null;
  readonly slot: { readonly day: number; readonly slot: number } | null;
}

export type PickEffect =
  | {
      readonly type: "place";
      readonly activity: PickedActivity;
      readonly day: number;
      readonly slot: number;
    }
  | { readonly type: "remove"; readonly day: number; readonly slot: number };

export interface PickResult {
  readonly pending: Pending;
  readonly effect: PickEffect | null;
}

export const NO_PENDING: Pending = { activity: null, slot: null };

/** Tapping an activity: places it in a waiting slot, else selects it (tap again to unselect). */
export function tapActivity(p: Pending, activity: PickedActivity): PickResult {
  if (p.slot) {
    return {
      pending: NO_PENDING,
      effect: { type: "place", activity, day: p.slot.day, slot: p.slot.slot },
    };
  }
  return {
    pending: p.activity === activity ? NO_PENDING : { activity, slot: null },
    effect: null,
  };
}

/**
 * Tapping a time slot. `occupant` is the base id of the activity already there (or null).
 * With an activity picked it places it (tapping its own spot takes it off); with none, a
 * filled slot is emptied and an empty one is highlighted to wait for an activity.
 */
export function tapSlot(
  p: Pending,
  day: number,
  slot: number,
  occupant: string | null,
): PickResult {
  if (p.activity) {
    if (p.activity === "rest" || occupant === p.activity) {
      return {
        pending: NO_PENDING,
        effect: occupant ? { type: "remove", day, slot } : null,
      };
    }
    return {
      pending: NO_PENDING,
      effect: { type: "place", activity: p.activity, day, slot },
    };
  }
  if (occupant) {
    return { pending: NO_PENDING, effect: { type: "remove", day, slot } };
  }
  const same = p.slot?.day === day && p.slot.slot === slot;
  return {
    pending: same ? NO_PENDING : { activity: null, slot: { day, slot } },
    effect: null,
  };
}

/** Changing an activity's version or pills option also makes it the pending pick. */
export function selectActivity(_p: Pending, activity: PickedActivity): Pending {
  return { activity, slot: null };
}

/** Escape: drop whatever is pending. */
export const clearPending = (): Pending => NO_PENDING;

// ---- The end of the week: which battle follows, in plain words. ----

export interface WeekEndText {
  readonly due: boolean;
  readonly line: string;
  /** The button that leaves the week screen. */
  readonly button: string;
}

/**
 * The closing line and button for a finished week. Only a viral doctor result has no battle; a
 * skirmish is the body's everyday patrol, never a quiet week.
 */
export function weekEndText(
  kind: BattleKind | null,
  reasons: readonly BattleReason[],
  medPct: string,
): WeekEndText {
  if (kind === null) {
    return {
      due: false,
      line: "It was just a virus. Nothing else came home with you, so there is no fight this week.",
      button: "Continue",
    };
  }
  if (kind === "skirmish") {
    return {
      due: true,
      line: "Nothing big landed this week, but your body is always on patrol. A small skirmish is starting.",
      button: "Start the skirmish",
    };
  }
  const line = reasons.includes("exposure")
    ? `Something came home with you. A battle is next, with your medication at ${medPct}.`
    : reasons.includes("reservoir")
      ? "Something left over is flaring up. A battle is next."
      : "The doctor found something, and now it is out in the open. A battle is next, with strong backup on your side.";
  return { due: true, line, button: "Start the battle" };
}

/** The week preview's odds label. The number is the chance of a full battle, not of any fight. */
export function battleOddsText(chanceFull: number): string {
  return `Full battle odds: ${pct(chanceFull)}`;
}

/** What the odds label means, for the (?) beside it. */
export const BATTLE_ODDS_HELP =
  "The chance that this plan brings a full battle this week. Otherwise it is a small skirmish.";

/** The energy as a signed amount: a cost has a minus, a refund a plus. */
export function energyDelta(cost: number): string {
  if (cost > 0) return `-${cost} energy`;
  if (cost < 0) return `+${-cost} energy`;
  return "0 energy";
}

/** The card face line: "+4 points, -2 energy, +40 score". `cost` is the sim's energy cost. */
export function scoreLine(points: number, cost: number, score: number): string {
  return `+${points} points, ${energyDelta(cost)}, +${score} score`;
}

// ---- The status strip: Points, Energy, Medication and Score (B1a design, section 2.2). ----

/** "2 antifungal, 1 antibacterial", or "no charges". Shared by the life and battle strips. */
export function chargesText(c: MedCharges): string {
  const parts = [
    c.antifungal > 0 ? `${c.antifungal} antifungal` : "",
    c.antibacterial > 0 ? `${c.antibacterial} antibacterial` : "",
    c.strong > 0 ? `${c.strong} strong` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "no charges";
}

/** The state word for a medication level made of `doses` of `window` doses. */
export function medStateWord(doses: number, window: number): string {
  if (doses >= window) return "full";
  if (doses <= 0) return "none";
  return doses * 2 >= window ? "reduced" : "low";
}

export const medDoses = (level: number) =>
  Math.round(level * PARAMS.life.meds.window);

const energyWord = (energy: number) =>
  energy >= 4 ? "plenty" : energy >= 2 ? "some" : "low";

/**
 * The four life-screen cells. `earlier` is the total score of the weeks already finished; it only
 * appears in the Score explanation.
 */
export function lifeStatusModel(life: LifeState, earlier = 0): StatusModel {
  const week = exposurePreview(life);
  const rows = energyPlan(life).flat();
  const endEnergy = rows.length ? rows[rows.length - 1] : life.energy;
  const max = L.maxEnergy;
  const target = life.goal.target;
  const points = life.goal.points;
  const planned = Math.max(points, week.points.planned);
  const window = PARAMS.life.meds.window;
  const doses = medDoses(week.medLevel);
  const choices = plannedChoices(life).total;

  const pointsCell: StatusCell = {
    id: "points",
    label: "Points",
    value: `${points}/${target}`,
    state:
      points >= target
        ? "goal met"
        : planned >= target
          ? "on track"
          : "building",
    bar: {
      kind: "fill",
      solid: points / target,
      ghost: planned / target,
    },
    showState: points >= target || planned >= target,
    color: "goal",
    explain:
      planned > points
        ? `Life points from your week: ${points} so far, ${planned} with your plan. Living fully earns them.`
        : `Life points from your week: ${points} so far. Living fully earns them.`,
  };
  const energyCell: StatusCell = {
    id: "energy",
    label: "Energy",
    value: `${life.energy}/${max}`,
    state: energyWord(life.energy),
    showState: life.energy < 2,
    bar: {
      kind: "segments",
      count: max,
      solid: Math.min(life.energy, endEnergy),
      ghost: Math.max(life.energy, endEnergy),
    },
    color: "energy",
    explain:
      endEnergy !== life.energy
        ? `Energy is a game-only resource. Activities cost it, rest gives it back. You have ${life.energy} now and ${endEnergy} after your plan.`
        : "Energy is a game-only resource. Activities cost it, rest gives it back.",
  };
  const medCell: StatusCell = {
    id: "medication",
    label: "Medication",
    value: `${doses}/${window}`,
    state: medStateWord(doses, window),
    showState: doses < window,
    bar: { kind: "segments", count: window, solid: doses, ghost: doses },
    color: "med",
    explain: `Doses taken over the last ${window} days, as planned: ${doses} of ${window}. That gives ${chargesText(week.charges)} in the fight. Fewer doses means a weaker aura and fewer charges.`,
  };
  const scoreCell: StatusCell = {
    id: "score",
    label: "Score",
    value: `${choices}`,
    state: "planned",
    showState: false,
    bar: null,
    color: "goal",
    explain:
      "Your score for this week's choices, if the plan plays out. Outcome is added after the fight." +
      (earlier > 0 ? ` Earlier weeks: ${earlier}.` : ""),
  };
  return { cells: [pointsCell, energyCell, medCell, scoreCell] };
}
