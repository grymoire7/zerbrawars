import type { CampaignStep, CampaignSummary } from "./campaign";
import type {
  BattleReason,
  CardId,
  Dose,
  DoctorTiming,
  Symptom,
} from "./life/types";
import type { PathogenKindId } from "./pathogens";
import type { BattleGrade, Order, SupportOrder } from "./types";

// The playtest session log (T14): plain JSON entries, appended in order, exported as a file. No
// names, dates or device data: `t` is milliseconds since the session started, supplied by the UI
// along with every other timing. Campaign steps are logged from their events; turns, probes and UI
// actions come from the UI directly.

interface At {
  /** Milliseconds since the session started. */
  readonly t: number;
}

interface InCycle extends At {
  readonly cycle: number;
}

export type SessionEntry =
  | (At & {
      readonly type: "session";
      readonly seed: number;
      readonly cycles: number;
    })
  | (InCycle & { readonly type: "weekStarted"; readonly energy: number })
  | (InCycle & {
      readonly type: "card";
      readonly action: "placed" | "removed";
      readonly day: number;
      readonly slot: number;
      readonly card: CardId;
      readonly packPills: boolean;
    })
  | (InCycle & {
      readonly type: "meds";
      readonly day: number;
      readonly taken: boolean;
      readonly cause: Dose["cause"];
    })
  | (InCycle & {
      readonly type: "friction";
      readonly day: number;
      readonly card: CardId;
    })
  | (InCycle & {
      readonly type: "symptom";
      readonly day: number;
      readonly kind: Symptom["kind"];
    })
  | (InCycle & {
      readonly type: "doctor";
      readonly day: number;
      readonly timing: DoctorTiming;
      readonly finding: "reservoir" | "viral";
      readonly revealed: number;
    })
  | (InCycle & {
      readonly type: "exposure";
      readonly day: number;
      readonly card: CardId;
      readonly chance: number;
      readonly landed: boolean;
      readonly kinds: readonly PathogenKindId[];
    })
  | (InCycle & {
      readonly type: "battleStarted";
      readonly reasons: readonly BattleReason[];
      readonly hiddenTokens: number;
    })
  | (InCycle & {
      readonly type: "turn";
      readonly turn: number;
      readonly orders: readonly Order[];
      readonly support: SupportOrder | null;
      /** From the telegraph appearing to End Turn. */
      readonly planningMs: number;
      /** Playback watched before it ended or was skipped. */
      readonly playbackMs: number;
      readonly skipped: boolean;
      readonly replays: number;
      /** Playback speed multiplier (1, 2). */
      readonly speed: number;
    })
  | (InCycle & {
      /** The prediction probe: what the player said would happen, scored by the observer. */
      readonly type: "probe";
      readonly turn: number;
      readonly correct: boolean | null;
      readonly note: string;
    })
  | (InCycle & {
      readonly type: "outcome";
      readonly result: BattleGrade | "quiet";
      readonly tissueLost: number;
      readonly reservoirs: number;
    })
  | (InCycle & {
      readonly type: "carried";
      readonly kept: number;
      readonly dropped: number;
      readonly energyNext: number;
    })
  | (At & {
      readonly type: "ui";
      readonly action: string;
      readonly detail: string;
    })
  | (At & { readonly type: "ended"; readonly summary: CampaignSummary });

export type SessionEntryType = SessionEntry["type"];

export interface SessionLog {
  readonly schema: 1;
  readonly entries: readonly SessionEntry[];
}

const TYPES: readonly SessionEntryType[] = [
  "session",
  "weekStarted",
  "card",
  "meds",
  "friction",
  "symptom",
  "doctor",
  "exposure",
  "battleStarted",
  "turn",
  "probe",
  "outcome",
  "carried",
  "ui",
  "ended",
];

export function createSessionLog(
  seed: number,
  cycles: number,
  t = 0,
): SessionLog {
  return { schema: 1, entries: [{ t, type: "session", seed, cycles }] };
}

/** Appends one entry. Throws if time runs backwards, so a log always replays in order. */
export function appendEntry(log: SessionLog, entry: SessionEntry): SessionLog {
  const last = log.entries.at(-1);
  if (last && entry.t < last.t) {
    throw new Error(
      `entry at ${entry.t} ms is before the last one (${last.t} ms)`,
    );
  }
  return { ...log, entries: [...log.entries, entry] };
}

/** The entries a campaign step's events make, all stamped `t`. */
export function entriesFor(step: CampaignStep, t: number): SessionEntry[] {
  const c = step.state;
  const cycle = c.cycle;
  const out: SessionEntry[] = [];
  for (const e of step.events) {
    switch (e.type) {
      case "Life": {
        const v = e.event;
        if (v.type === "CardPlaced" || v.type === "CardRemoved") {
          const p = c.life.plan[v.day]?.[v.slot];
          out.push({
            t,
            cycle,
            type: "card",
            action: v.type === "CardPlaced" ? "placed" : "removed",
            day: v.day,
            slot: v.slot,
            card: v.card,
            packPills:
              v.type === "CardPlaced" && p?.card === v.card
                ? p.packPills
                : false,
          });
        } else if (v.type === "MedsTaken" || v.type === "MedsSkipped") {
          out.push({
            t,
            cycle,
            type: "meds",
            day: v.day,
            taken: v.type === "MedsTaken",
            cause: v.cause,
          });
        } else if (v.type === "FrictionEvent") {
          out.push({ t, cycle, type: "friction", day: v.day, card: v.card });
        } else if (v.type === "SymptomAppeared") {
          out.push({
            t,
            cycle,
            type: "symptom",
            day: v.symptom.day,
            kind: v.symptom.kind,
          });
        } else if (v.type === "DoctorVisited") {
          out.push({
            t,
            cycle,
            type: "doctor",
            day: v.day,
            timing: v.timing,
            finding: v.finding,
            revealed: v.revealed,
          });
        } else if (v.type === "ExposureRolled") {
          out.push({
            t,
            cycle,
            type: "exposure",
            day: v.day,
            card: v.card,
            chance: v.chance,
            landed: v.landed,
            kinds: v.kinds,
          });
        }
        break;
      }
      case "WeekStarted":
        out.push({ t, cycle: e.cycle, type: "weekStarted", energy: e.energy });
        break;
      case "BattleStarted":
        out.push({
          t,
          cycle,
          type: "battleStarted",
          reasons: e.reasons,
          hiddenTokens: e.hiddenTokens,
        });
        break;
      case "QuietWeek":
        out.push({
          t,
          cycle,
          type: "outcome",
          result: "quiet",
          tissueLost: 0,
          reservoirs: 0,
        });
        break;
      case "BattleEnded":
        out.push({
          t,
          cycle,
          type: "outcome",
          result: e.outcome.grade,
          tissueLost: e.outcome.tissue.lost,
          reservoirs: e.outcome.reservoirs.length,
        });
        break;
      case "Carried":
        out.push({
          t,
          cycle: c.history.at(-1)?.cycle ?? cycle,
          type: "carried",
          kept: e.kept.length,
          dropped: e.dropped.length,
          energyNext: e.energy.to,
        });
        break;
      case "CampaignEnded":
        out.push({ t, type: "ended", summary: e.summary });
        break;
      case "Battle":
        break;
    }
  }
  return out;
}

/** Logs a campaign step: every entry its events make, stamped `t`. */
export function logStep(
  log: SessionLog,
  step: CampaignStep,
  t: number,
): SessionLog {
  return entriesFor(step, t).reduce(appendEntry, log);
}

export function exportSessionLog(log: SessionLog): string {
  return JSON.stringify(log, null, 2);
}

/** Reads an exported log back. Throws on anything that is not one. */
export function parseSessionLog(text: string): SessionLog {
  const data: unknown = JSON.parse(text);
  const log = data as SessionLog;
  if (
    typeof data !== "object" ||
    data === null ||
    log.schema !== 1 ||
    !Array.isArray(log.entries)
  ) {
    throw new Error("not a session log");
  }
  log.entries.forEach((e, i) => {
    if (typeof e?.t !== "number" || !TYPES.includes(e.type)) {
      throw new Error(`entry ${i} is not a session entry`);
    }
  });
  return log;
}
