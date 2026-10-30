import { describe, expect, it } from "vitest";
import { PARAMS } from "../sim/params";
import { createCampaign, endWeek } from "../sim/campaign";
import { medLevelOf } from "../sim/life/meds";
import type { CampaignEvent } from "../sim/campaign";
import {
  aftermathText,
  bodyBeats,
  broughtItems,
  dosesForMed,
  doctorLines,
  medTier,
  parseReservoirs,
  probeDue,
  symptomText,
  weekOpening,
} from "./campaignModel";

describe("probeDue", () => {
  it("fires on turns 2, 4 and 6 only when enabled", () => {
    const on = [1, 2, 3, 4, 5, 6, 7, 8].filter((t) => probeDue(t, true));
    expect(on).toEqual([2, 4, 6]);
    expect(probeDue(2, false)).toBe(false);
  });
});

describe("parseReservoirs", () => {
  it("reads kinds and sizes, skipping unknown names", () => {
    expect(parseReservoirs("aspergillus,staph:1,dragon")).toEqual([
      { kind: "aspergillus", size: 2, hidden: true },
      { kind: "staph", size: 1, hidden: true },
    ]);
    expect(parseReservoirs(null)).toEqual([]);
  });
  it("keeps at most the carry cap", () => {
    expect(parseReservoirs("strep,strep,strep,strep").length).toBe(2);
  });
});

describe("dosesForMed", () => {
  it("builds a history at the asked level", () => {
    expect(medLevelOf(dosesForMed(1))).toBe(1);
    expect(medLevelOf(dosesForMed(0))).toBe(0);
    expect(medLevelOf(dosesForMed(0.67))).toBeCloseTo(0.67, 1);
  });
});

describe("medTier", () => {
  it("follows the charge tiers", () => {
    expect(medTier(1).index).toBe(0);
    expect(medTier(0.5).index).toBe(1);
    expect(medTier(0).index).toBe(2);
  });
});

describe("symptoms and the doctor", () => {
  it("uses plain, warm words", () => {
    expect(symptomText({ kind: "lowFever", day: 0 })).toMatch(/low fever/);
    expect(symptomText({ kind: "soreSpot", day: 0 })).toMatch(/sore spot/);
  });
  it("never names a kind when a reservoir grows or flares", () => {
    const text = bodyBeats([
      { type: "ReservoirGrew", day: 0, index: 0, size: 3 },
      { type: "ReservoirFlared", day: 1, index: 0, chance: 0.2 },
    ]).join(" ");
    expect(text).not.toMatch(/mold|bacteri|fung|staph|strep/i);
  });
  it("reports a viral visit with the refund and a found reservoir with the count", () => {
    const base = {
      type: "DoctorVisited" as const,
      day: 1,
      slot: 0,
      timing: "early" as const,
      energy: 0,
    };
    expect(bodyBeats([{ ...base, finding: "viral", revealed: 0 }])[0]).toMatch(
      /virus.*good call.*energy back/i,
    );
    expect(
      bodyBeats([{ ...base, finding: "reservoir", revealed: 2 }])[0],
    ).toMatch(/2 hidden spots/);
  });
  it("the doctor card never says whether anything is hiding", () => {
    const lines = doctorLines({
      timing: "early",
      energy: -1,
      earlyUntil: 1,
      viralRefund: 1,
      charges: { antibacterial: 1, antifungal: 2, strong: 1 },
    }).join(" ");
    expect(lines).toMatch(/early/);
    expect(lines).toMatch(/1 strong charge/);
    expect(lines).not.toMatch(/you have|you are carrying/i);
  });
});

describe("broughtItems", () => {
  it("lists medication, exposure sources, carried spots and energy", () => {
    const start = createCampaign({
      seed: 3,
      reservoirs: [{ kind: "aspergillus", size: 2, hidden: true }],
    }).state;
    const life = {
      ...start.life,
      day: PARAMS.life.days,
      exposures: [
        {
          day: 0,
          slot: 0,
          card: "lake" as const,
          kind: "strep" as const,
          size: 1,
        },
        {
          day: 0,
          slot: 0,
          card: "lake" as const,
          kind: "staph" as const,
          size: 1,
        },
      ],
    };
    const items = broughtItems(endWeek({ ...start, life }).state);
    const titles = items.map((i) => i.title).join("|");
    expect(titles).toMatch(/Medication 100%/);
    expect(titles).toMatch(/lake/i);
    expect(titles).toMatch(/1 carried-over spot/);
    expect(titles).toMatch(/Energy/);
    expect(items.find((i) => /lake/i.test(i.title))?.detail).toBe(
      "bacteria + bacteria (shelled)",
    );
  });
});

describe("skirmish aftermath", () => {
  const worn = { kind: "wornOut", energy: 1 } as const;
  const flare = { kind: "flareUp", energy: 1 } as const;

  it("reads as flavor with the energy cost, not as a symptom", () => {
    expect(aftermathText(worn)).toMatch(/^You feel worn out\./);
    expect(aftermathText(worn)).toContain("costs 1 energy");
    expect(aftermathText(flare)).toMatch(/^A spot flares up\./);
    expect(aftermathText(flare)).not.toMatch(/doctor/i);
  });

  it("opens the week, ahead of symptoms", () => {
    const events: CampaignEvent[] = [
      { type: "Life", event: { type: "SkirmishAftermath", aftermath: worn } },
    ];
    expect(weekOpening(events)).toEqual([aftermathText(worn)]);
    expect(
      bodyBeats([{ type: "SkirmishAftermath", aftermath: flare }]),
    ).toEqual([aftermathText(flare)]);
  });
});
