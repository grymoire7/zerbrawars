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
  Dose,
  LifeEvent,
  LifeState,
} from "../sim/life/types";
import type { BattleKind } from "../sim/types";
import { bodyBeats } from "./campaignModel";
import { PARAMS } from "../sim/params";
import { organismList, organismName } from "../sim/organisms";
import type { PathogenKindId } from "../sim/pathogens";

// Pure helpers that turn life-phase state into plain words and numbers for the calendar UI and
// the body inset. Nothing here touches the DOM or three.js.

const L = PARAMS.life;
const EVENING = L.slotsPerDay - 1;

export const slotName = (slot: number) =>
  slot === EVENING ? "Evening" : "Daytime";

export const pct = (x: number) => `${Math.round(x * 100)}%`;

const unique = (kinds: readonly PathogenKindId[]) => [...new Set(kinds)];

/** Honest odds in words, e.g. "45% chance of exposure to Aspergillus". */
export function oddsText(
  chance: number,
  kinds: readonly PathogenKindId[],
): string {
  return `${Math.round(chance * 100)}% chance of exposure to ${organismList(unique(kinds))}`;
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
  if (problem === "game night is only in the evening")
    return "Game night is only in the evening";
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

const dayName = (day: number, slot: number) =>
  `${slotName(slot).toLowerCase()} on Day ${day + 1}`;

function tooTight(
  life: LifeState,
  day: number,
  slot: number,
  card: CardId,
  packPills: boolean,
): boolean {
  return placementProblems(life, day, slot, card, packPills).includes(
    "not enough energy",
  );
}

/**
 * What to do when `card` does not fit the energy in this slot: another slot where it does, or the
 * placed card(s) that cost the fewest life points to drop. Plain and concrete, never a scolding.
 * `life` must already have `card` lifted off any other spot.
 */
export function energyAdvice(
  life: LifeState,
  day: number,
  slot: number,
  card: CardId,
  packPills: boolean,
): string {
  const lead = "Not enough energy.";
  // A later slot has had more rests before it.
  for (let d = life.day; d < L.days; d++) {
    for (let s = 0; s < L.slotsPerDay; s++) {
      if (d === day && s === slot) continue;
      if (life.plan[d][s]) continue;
      if (placementProblems(life, d, s, card, packPills).length === 0)
        return `${lead} It fits in the ${dayName(d, s)}.`;
    }
  }
  const placed: { label: string; points: number; day: number; slot: number }[] =
    [];
  for (let d = life.day; d < L.days; d++) {
    for (let s = 0; s < L.slotsPerDay; s++) {
      const p = life.plan[d][s];
      if (p && !cardDef(p.card).doctor && !(d === day && s === slot))
        placed.push({
          label: cardDef(p.card).label,
          points: cardDef(p.card).points,
          day: d,
          slot: s,
        });
    }
  }
  const without = (...xs: typeof placed) =>
    xs.reduce((l, x) => unplaceCard(l, x.day, x.slot).state, life);
  const fits = (l: LifeState) => !tooTight(l, day, slot, card, packPills);
  const one = placed
    .filter((x) => fits(without(x)))
    .sort((a, b) => a.points - b.points)[0];
  const swapWith = cardDef(card).label;
  if (one)
    return `${lead} Drop ${one.label} (${one.points} points) to fit ${swapWith}, or rest a slot first.`;
  let best: [(typeof placed)[number], (typeof placed)[number]] | null = null;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      if (!fits(without(placed[i], placed[j]))) continue;
      const cost = placed[i].points + placed[j].points;
      if (!best || cost < best[0].points + best[1].points)
        best = [placed[i], placed[j]];
    }
  }
  if (best)
    return `${lead} Drop ${best[0].label} and ${best[1].label} to fit ${swapWith}, or rest a slot first.`;
  return `${lead} Rest a slot first, or drop a card.`;
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
    (r) =>
      r === "not enough energy"
        ? energyAdvice(base, day, slot, card, packPills)
        : friendlyProblem(r),
  );
  return { day, slot, ok: reasons.length === 0, reasons };
}

/** The chip glyph: a check, "!" for a dose the plan puts at risk, a cross for a missed one. */
export type DoseGlyph = "check" | "alert" | "cross";

/**
 * One day's dose as a read-only forecast cell. Nothing here is a control: doses are taken by
 * routine, and a miss arises from life (an unpacked sleepover), never from a tap.
 */
export interface DoseCell {
  readonly day: number;
  readonly taken: boolean;
  /** Already decided (taken, defaulted or lost) rather than a forecast. */
  readonly decided: boolean;
  readonly level: number;
  /** The state in plain words: "routine", "taken", "pills at home" or "missed". */
  readonly why: string;
  readonly glyph: DoseGlyph;
  /** Chance this dose slips (0..1) for the percentage on the chip, or null when none applies. */
  readonly chance: number | null;
  /** The whole cell in one sentence, for the accessible name. */
  readonly label: string;
}

const WORD = {
  tapped: "routine",
  default: "routine",
  skipped: "missed",
  friction: "pills at home",
  slipped: "pills slipped",
} as const;

const DONE_WORD = { ...WORD, tapped: "taken", default: "taken" } as const;

function doseCell(
  day: number,
  d: Dose,
  decided: boolean,
  level: number,
  chance: number | null,
): DoseCell {
  const risk = d.taken && chance !== null;
  const why = risk ? "late night" : (decided ? DONE_WORD : WORD)[d.cause];
  const glyph: DoseGlyph = risk
    ? "alert"
    : d.taken
      ? "check"
      : d.cause === "friction"
        ? "alert"
        : "cross";
  const detail =
    d.cause === "friction"
      ? "the pills are at home after the sleepover"
      : d.cause === "slipped"
        ? "game night ran late and the evening pills slipped"
        : why;
  const pctText =
    chance === null
      ? ""
      : `, ${Math.round(chance * 100)} percent chance the pills slip`;
  return {
    day,
    taken: d.taken,
    decided,
    level,
    why,
    glyph,
    chance,
    label: `Day ${day + 1} meds: ${detail}${pctText}, medication ${Math.round(level * 100)} percent.`,
  };
}

/** Every day of the week: the dose as it stands (or is forecast) and the med level after it. */
export function doseStrip(life: LifeState): DoseCell[] {
  const cells: DoseCell[] = [];
  for (let day = 0; day < Math.min(life.day, L.days); day++) {
    const i = life.doses.findIndex(
      (d) => d.week === life.week && d.day === day,
    );
    if (i < 0) continue;
    cells.push(
      doseCell(
        day,
        life.doses[i],
        true,
        medLevelOf(life.doses.slice(0, i + 1)),
        null,
      ),
    );
  }
  if (life.day < L.days) {
    for (const f of medForecast(life)) {
      const decided = life.doses.some(
        (d) => d.week === life.week && d.day === f.day,
      );
      cells.push(
        doseCell(
          f.day,
          { week: life.week, day: f.day, taken: f.taken, cause: f.cause },
          decided,
          f.level,
          f.chance,
        ),
      );
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
            : e.cause === "slipped"
              ? "Game night ran late; the evening pills slipped."
              : "Today's dose is missed.",
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
            ? `Exposure to ${organismName(e.kind)} landed (it was a ${pct(e.chance)} chance).`
            : `No exposure to ${organismName(e.kind)} this time (${pct(e.chance)} chance).`,
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
 * has something to decide on the new morning: a symptom showed (book the doctor). It also stops
 * when the week ends. The sleepover's missed dose does not stop it: that choice was made when the
 * card was placed without the pills, and the day log reports it. The first day pressed is always played.
 */
export function weekPlayStops(events: readonly LifeEvent[]): boolean {
  return events.some(
    (e) => e.type === "SymptomAppeared" || e.type === "WeekEnded",
  );
}

export interface StopBanner {
  readonly kind: "symptom";
  /** 1-based day number the event belongs to, as the player sees it. */
  readonly day: number;
  /** Plain names of the symptoms that showed ("a low fever"). */
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
 * Why "Play the week" stopped, in words, from the events of the day just played. Null when nothing but the week's end stopped it. `canBook` says the
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
  const groups = new Map<
    string,
    { card: CardId; kinds: PathogenKindId[]; n: number }
  >();
  for (const x of life.exposures) {
    const key = `${x.day}:${x.slot}`;
    const g = groups.get(key) ?? { card: x.card, kinds: [], n: 0 };
    g.n += 1;
    g.kinds.push(x.kind);
    groups.set(key, g);
  }
  return {
    landed: [...groups.values()].map((g) => ({
      text: `${labelOf(g.card)}: ${g.n} exposure${g.n > 1 ? "s" : ""} to ${organismList(unique(g.kinds))}`,
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
      line: "It was just a virus. Nothing else came home with you.",
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

export type ExposureWord = "none" | "low" | "some" | "likely";

export interface WeekOdds {
  /** 1 - product(1 - chance) over every played roll and pending card, 0..1, unrounded. */
  readonly chance: number;
  /** The chance rounded to 5 ("35%"), or "under 5%" when non-zero but below 5. */
  readonly value: string;
  /** none, low, some or likely before the week is played; what happened once a day is played. */
  readonly state: string;
  /** A carried reservoir exists. Never part of the percentage. */
  readonly leftover: boolean;
}

/**
 * The Exposure cell: the chance something from this week's plan comes home with you. Played cards
 * count with the odds they rolled at, pending ones with the odds on their cards. The doctor card
 * brings nothing in and a leftover is only a tag, so neither moves the number. The state word comes
 * from the rounded value, so the word never disagrees with the number beside it.
 */
export function weekOdds(life: LifeState): WeekOdds {
  let none = 1;
  for (const r of life.rolls) none *= 1 - r.chance;
  for (const p of exposurePreview(life).pending) none *= 1 - p.preview.chance;
  const chance = 1 - none;
  const rounded = Math.round(chance * 20) * 5;
  const value =
    chance > 0 && rounded === 0 ? "under 5%" : `${Math.min(100, rounded)}%`;
  const word: ExposureWord =
    chance <= 0
      ? "none"
      : rounded < 20
        ? "low"
        : rounded < 50
          ? "some"
          : "likely";
  const came = life.exposures.length > 0;
  const state =
    life.day === 0
      ? word
      : came
        ? "came home"
        : life.day >= L.days
          ? "stayed away"
          : "so far clear";
  return { chance, value, state, leftover: life.reservoirs.length > 0 };
}

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

// ---- The status strip: Points, Energy, Medication, Exposure and Score (B1a design, section 2.2). ----

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
 * The five life-screen cells. `earlier` is the total score of the weeks already finished; it only
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
    short: "Meds",
    value: `${doses}/${window}`,
    state: medStateWord(doses, window),
    showState: doses < window,
    bar: { kind: "segments", count: window, solid: doses, ghost: doses },
    color: "med",
    explain: `Doses taken over the last ${window} days, as planned: ${doses} of ${window}. That gives ${chargesText(week.charges)} in the fight. Fewer doses means a weaker aura and fewer charges.`,
  };
  const odds = weekOdds(life);
  const exposureCell: StatusCell = {
    id: "exposure",
    label: "Exposure",
    value: odds.leftover ? `${odds.value} + leftover` : odds.value,
    state: odds.state,
    showState: true,
    bar: { kind: "fill", solid: odds.chance, ghost: odds.chance },
    // A colour band that follows the odds; the state word always rides with it.
    color: odds.chance < 0.2 ? "swarm" : odds.chance < 0.5 ? "notice" : "heat",
    explain:
      `The chance something from this week's plan comes home with you: ${odds.value}. These are game odds. Your medicine does not change them; it helps your cells in the fight.` +
      (odds.leftover
        ? " Something left over from last week may also flare up; the doctor can find it."
        : ""),
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
      "Your score for this week's choices, if the plan plays out: points, odds pushed, routine kept and a bonus for meeting the goal. Outcome is added after the fight." +
      (earlier > 0 ? ` Earlier weeks: ${earlier}.` : ""),
  };
  return { cells: [pointsCell, energyCell, medCell, exposureCell, scoreCell] };
}
