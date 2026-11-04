import type { Campaign, CampaignEvent, CycleRecord } from "../sim/campaign";
import { cardDef } from "../sim/life/cards";
import type { CarriedReservoir } from "../sim/life/loadout";
import type {
  Aftermath,
  CardId,
  Dose,
  LifeEvent,
  Symptom,
} from "../sim/life/types";
import { PARAMS } from "../sim/params";
import {
  isPathogenKindId,
  pathogenKind,
  type PathogenKindId,
} from "../sim/pathogens";
import type { MedCharges } from "../sim/types";

// Pure helpers for the campaign UI: plain words for symptoms and the doctor, the "you brought"
// strip, and the debug-start parsing. Nothing here touches the DOM.

const W = PARAMS.life.meds.window;

export const SYMPTOM_TEXT: Record<Symptom["kind"], string> = {
  lowFever: "You feel a low fever.",
  soreSpot: "You have a sore spot that is not going away.",
  tired: "You feel tired. It costs you some energy this week.",
};

export const symptomText = (s: Symptom): string => SYMPTOM_TEXT[s.kind];

export const DOCTOR_NUDGE =
  "Not sure what it is? Your care team can fit you in. The doctor card is in your hand.";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Doctor-visit event as a short result beat. It only says what was found, never earlier. */
export function doctorBeat(
  e: Extract<LifeEvent, { type: "DoctorVisited" }>,
): string[] {
  const when =
    e.timing === "early"
      ? "You went early, which made it easier."
      : "It was a bit late, but going still counts.";
  if (e.finding === "viral") {
    const back = PARAMS.campaign.doctor.viralRefund;
    return [
      `It was a virus. Good call coming in: nothing is hiding. You get ${back} energy back.`,
      when,
    ];
  }
  return [
    `The imaging found ${plural(e.revealed, "hidden spot")}. ${e.revealed === 1 ? "It shows" : "They show"} on the board now, and you leave with a strong charge for the next fight.`,
    when,
  ];
}

/** Symptoms, growth and flares as plain beats. Growth and flares never name a kind. */
export function bodyBeats(events: readonly LifeEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    if (e.type === "SkirmishAftermath") out.push(aftermathText(e.aftermath));
    else if (e.type === "SymptomAppeared") out.push(symptomText(e.symptom));
    else if (e.type === "DoctorVisited") out.push(...doctorBeat(e));
    else if (e.type === "ReservoirGrew")
      out.push("You feel worse than yesterday. Something is not settling.");
    else if (e.type === "ReservoirFlared")
      out.push(
        "Your symptoms are spiking: something is flaring up. A battle is coming.",
      );
  }
  return out;
}

export const aftermathTitle = (a: Aftermath): string =>
  a.kind === "wornOut" ? "You feel worn out" : "A spot flares up";

/** The second half of the aftermath beat: where the white cells were, and the energy it cost. */
export const aftermathDetail = (a: Aftermath): string =>
  `${a.kind === "flareUp" ? "It settles again. " : ""}Your white cells were off fighting somewhere else today. It costs ${a.energy} energy this week.`;

/** The flavor beat a lost skirmish leaves at the start of the next week. Not a symptom. */
export const aftermathText = (a: Aftermath): string =>
  `${aftermathTitle(a)}. ${aftermathDetail(a)}`;

/**
 * The week-start lines: a skirmish aftermath first (flavor, not a symptom), then symptoms that
 * show at once.
 */
export function weekOpening(events: readonly CampaignEvent[]): string[] {
  return events.flatMap((e) => {
    if (e.type !== "Life") return [];
    if (e.event.type === "SkirmishAftermath")
      return [aftermathText(e.event.aftermath)];
    if (e.event.type === "SymptomAppeared")
      return [symptomText(e.event.symptom)];
    return [];
  });
}

export function chargesText(c: MedCharges): string {
  const parts = [
    c.strong > 0 ? plural(c.strong, "strong charge") : "",
    c.antifungal > 0 ? `${c.antifungal} antifungal` : "",
    c.antibacterial > 0 ? `${c.antibacterial} antibacterial` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "none";
}

/** The doctor card's body, from the sim's preview. It never says whether anything is hiding. */
export function doctorLines(p: {
  readonly timing: "early" | "late";
  readonly energy: number;
  readonly earlyUntil: number | null;
  readonly viralRefund: number;
  readonly charges: MedCharges;
}): string[] {
  const cost =
    p.energy > 0
      ? `Costs ${p.energy} energy.`
      : p.energy < 0
        ? `Costs nothing, and you get ${-p.energy} energy back.`
        : "Costs no energy.";
  const when =
    p.timing === "early"
      ? p.earlyUntil === null
        ? "Going early makes it cheaper."
        : `Going early (through day ${p.earlyUntil + 1}) makes it cheaper.`
      : "It is later than ideal, so the visit costs more. It still works.";
  return [
    `${when} ${cost}`,
    `Imaging shows what is hiding. You leave with backup for the next fight (${chargesText(p.charges)}).`,
    `If it is only a virus, you get ${p.viralRefund} energy back.`,
  ];
}

/** Medication tier from the same table that sets charges. */
export function medTier(level: number): { name: string; index: number } {
  const tiers = PARAMS.meds.chargeTiers;
  const index = tiers.findIndex((t) => level >= t.minLevel);
  const names = ["full shield", "partial shield", "shield is down"];
  return { name: names[Math.max(0, index)] ?? "shield", index };
}

export interface BroughtItem {
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
}

const CARD_ICON: Record<CardId, string> = {
  yard: "🌿",
  yardIndoor: "🌿",
  lake: "🌊",
  beach: "🏖",
  band: "🎸",
  sleepover: "🌙",
  game: "🎲",
  gameEarly: "🎲",
  doctor: "🩺",
};

const kindWord = (k: PathogenKindId) => {
  const def = pathogenKind(k);
  return def.form === "mold" ? "mold" : "bacteria";
};

/** How the week shaped this fight: one item per fact, in the order the player lived them. */
export function broughtItems(c: Campaign): BroughtItem[] {
  const life = c.life;
  const battle = c.battle;
  const items: BroughtItem[] = [];
  const tier = medTier(life.medLevel);
  const charges = battle ? chargesText(battle.meds.charges) : "none";
  items.push({
    icon: "💊",
    title: `Medication ${Math.round(life.medLevel * 100)}%`,
    detail: `${tier.name}; charges: ${charges}`,
  });
  const byCard = new Map<string, { card: CardId; kinds: PathogenKindId[] }>();
  for (const x of life.exposures) {
    const key = `${x.day}:${x.slot}`;
    const g = byCard.get(key) ?? { card: x.card, kinds: [] };
    g.kinds.push(x.kind);
    byCard.set(key, g);
  }
  for (const g of byCard.values()) {
    const sealed = g.kinds.filter(
      (k) => pathogenKind(k).wall === "sealed",
    ).length;
    items.push({
      icon: CARD_ICON[g.card],
      title: cardDef(g.card).label,
      detail:
        g.kinds.map(kindWord).join(" + ") + (sealed > 0 ? " (shelled)" : ""),
    });
  }
  if (c.battleKind === "skirmish") {
    // A little patrol: no exposures, and the carried-over spots stay off its board.
    items.push({
      icon: "⚡",
      title: `Energy ${life.energy}`,
      detail: "left after the week",
    });
    return items;
  }
  const hidden = life.reservoirs.filter((r) => r.hidden && !r.flared);
  const shown = life.reservoirs.filter((r) => !r.hidden || r.flared);
  if (hidden.length > 0) {
    items.push({
      icon: "❔",
      title: `${plural(hidden.length, "carried-over spot")}`,
      detail: "still hidden on the board",
    });
  }
  for (const r of shown) {
    items.push({
      icon: "📍",
      title: `Carried-over ${kindWord(r.kind)}`,
      detail: r.flared ? "flared up this week" : "found by the doctor",
    });
  }
  if (life.flags.doctorVisit) {
    items.push({
      icon: "🏥",
      title: "Doctor visit",
      detail: "hidden germs revealed, plus a strong charge",
    });
  }
  items.push({
    icon: "⚡",
    title: `Energy ${life.energy}`,
    detail: "left after the week",
  });
  return items;
}

/** The strip's heading for a skirmish. */
export const SKIRMISH_HEADING = "A little skirmish somewhere in your body";

/** Why the battle is happening, in a few words per reason. */
export function reasonText(
  reasons: readonly ("exposure" | "reservoir" | "doctor")[],
): string {
  const parts = reasons.map((r) =>
    r === "exposure"
      ? "something came home with you"
      : r === "reservoir"
        ? "something left over flared up"
        : "the doctor found something",
  );
  return parts.length > 0 ? parts.join("; ") : "";
}

/** True on turns 2, 4 and 6 when the facilitator has the probe on. */
export function probeDue(turn: number, enabled: boolean): boolean {
  return enabled && turn >= 2 && turn <= 6 && turn % 2 === 0;
}

/** ?goal=N: an integer 6..20 overrides the goal target; anything else is ignored (undefined). */
export function parseGoal(raw: string | null): number | undefined {
  if (raw === null || !/^\d+$/.test(raw.trim())) return undefined;
  const n = Number(raw);
  return n >= 6 && n <= 20 ? n : undefined;
}

/** "aspergillus,staph:2" -> reservoirs (hidden, size 1 unless given). Unknown names are skipped. */
export function parseReservoirs(raw: string | null): CarriedReservoir[] {
  if (!raw) return [];
  const out: CarriedReservoir[] = [];
  for (const part of raw.split(",")) {
    const [name, size] = part.trim().split(":");
    if (!isPathogenKindId(name ?? "")) continue;
    const n = Number(size);
    out.push({
      kind: name as PathogenKindId,
      size: Number.isFinite(n) && n >= 1 ? Math.min(3, Math.round(n)) : 2,
      hidden: true,
    });
  }
  return out.slice(0, PARAMS.campaign.carry.maxReservoirs);
}

/** A dose history whose current med level is `level` (rounded to the window). */
export function dosesForMed(level: number, week = 1): Dose[] {
  const missed = Math.round((1 - Math.min(1, Math.max(0, level))) * W);
  return Array.from({ length: W }, (_, i) => ({
    week: week - 1,
    day: PARAMS.life.days - W + i,
    taken: i >= missed,
    cause: i >= missed ? ("default" as const) : ("skipped" as const),
  }));
}

export interface WeekLine {
  readonly week: number;
  readonly points: string;
  readonly result: string;
  readonly doctor: string;
  readonly carried: string;
}

const SKIRMISH_TEXT = {
  cleared: "skirmish: cleared",
  loose: "skirmish: something still stirring",
} as const;

const GRADE_TEXT = {
  cleared: "battle: all clear",
  contained: "battle: contained",
  neededBackup: "battle: backup arrived",
} as const;

/** One row of the end-of-campaign summary. */
export function weekLine(h: CycleRecord): WeekLine {
  const result =
    h.result.kind === "quiet"
      ? "just a virus, no fight"
      : h.result.battleKind === "skirmish"
        ? SKIRMISH_TEXT[
            h.result.outcome.grade === "cleared" ? "cleared" : "loose"
          ]
        : GRADE_TEXT[h.result.outcome.grade];
  const doctor = h.doctor
    ? h.doctor.finding === "reservoir"
      ? `doctor visit (${h.doctor.timing}): found something`
      : `doctor visit (${h.doctor.timing}): it was a virus`
    : h.symptoms.length > 0
      ? "symptoms, no visit"
      : "no doctor visit";
  const carried =
    h.carried.length === 0
      ? "nothing carried over"
      : "carried: " +
        h.carried
          .map((r) => `${pathogenKind(r.kind).organism} (size ${r.size})`)
          .join(", ");
  return {
    week: h.week,
    points: `${h.points} of ${h.goalTarget} points${h.goalMet ? " (goal met)" : ""}`,
    result,
    doctor,
    carried,
  };
}
