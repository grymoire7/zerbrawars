import { describe, expect, it } from "vitest";
import {
  createLife,
  placeCard,
  placementProblems,
  slipChanceFor,
} from "./life/calendar";
import { cardDef, handFor } from "./life/cards";
import type { CardId, LifeState } from "./life/types";
import {
  bestPlacements,
  LIFE_BOTS,
  planPlacements,
  placeFitting,
} from "./life/bots";
import { PARAMS } from "./params";
import { plannedChoices } from "./score";

// Week-phase design section 5: every legal plan of the five-card week-1 hand (each card used at
// most once, either version, any slot, sleepover packed or not), scored by plannedChoices. Checks
// the claims the design makes about the Score v4 landscape.

interface Plan {
  readonly life: LifeState;
  readonly choices: number;
  readonly points: number;
  readonly cards: readonly string[];
}

const HAND = handFor(1);

function enumerate(): Plan[] {
  const out: Plan[] = [];
  const base = createLife({ seed: 1 });
  const versions = (card: CardId): CardId[] => {
    const def = cardDef(card);
    return def.smarter ? [card, def.smarter] : [card];
  };
  const walk = (i: number, life: LifeState, cards: string[]) => {
    if (i === HAND.length) {
      const p = plannedChoices(life);
      out.push({
        life,
        choices: p.total,
        points: p.living / PARAMS.score.perPoint,
        cards,
      });
      return;
    }
    walk(i + 1, life, cards);
    for (const v of versions(HAND[i])) {
      for (let day = 0; day < PARAMS.life.days; day++) {
        for (let slot = 0; slot < PARAMS.life.slotsPerDay; slot++) {
          for (const pack of cardDef(v).overnight ? [true, false] : [false]) {
            if (placementProblems(life, day, slot, v, pack).length > 0)
              continue;
            walk(i + 1, placeCard(life, day, slot, v, pack).state, [
              ...cards,
              `${v}@${day}.${slot}${pack ? "+pills" : ""}`,
            ]);
          }
        }
      }
    }
  };
  walk(0, base, []);
  return out;
}

const plans = enumerate();
const goal = PARAMS.life.goalTarget;
const best = Math.max(...plans.map((p) => p.choices));
const top = plans.filter((p) => p.choices === best);

describe("week 1 plan landscape (Score v4)", () => {
  it("prints the numbers", () => {
    const met = plans.filter((p) => p.points >= goal).length;
    const near = plans.filter((p) => p.choices >= 0.9 * best).length;
    (
      globalThis as unknown as { console: { log(s: string): void } }
    ).console.log(
      `plans ${plans.length}, goal met ${met}, within 10% of best ${near}, best ${best} (${top.length} plans tie, e.g. ${top[0].cards.join(" ")})`,
    );
  });

  it("enumerates a plan space big enough to mean something", () => {
    expect(plans.length).toBeGreaterThan(50);
  });

  it("never has an unpacked sleepover or a late-night game night in a best plan", () => {
    for (const t of top) {
      const l = t.life;
      for (let d = 0; d < PARAMS.life.days; d++) {
        expect(slipChanceFor(l, d), t.cards.join(" ")).toBeNull();
        const p = l.plan[d - 1]?.[PARAMS.life.slotsPerDay - 1];
        if (p && cardDef(p.card).overnight) expect(p.packPills).toBe(true);
      }
    }
  });

  it("has goal-meeting plans that are a minority but not rare", () => {
    const share = plans.filter((p) => p.points >= goal).length / plans.length;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.5);
  });

  it("leaves more than one plan within 10% of the best", () => {
    expect(plans.filter((p) => p.choices >= 0.9 * best).length).toBeGreaterThan(
      1,
    );
  });

  it("scores the design's worked example about 296", () => {
    let l = createLife({ seed: 1 });
    for (const [day, slot, card, pack] of [
      [0, 0, "yardIndoor", false],
      [0, 1, "sleepover", true],
      [1, 1, "beach", false],
      [2, 1, "gameEarly", false],
    ] as const)
      l = placeCard(l, day, slot, card, pack).state;
    const c = plannedChoices(l);
    (
      globalThis as unknown as { console: { log(s: string): void } }
    ).console.log(`worked example: ${JSON.stringify(c)}`);
    expect(Math.abs(c.total - 296)).toBeLessThanOrEqual(5);
  });

  it("has a planner bot that plays a best enumerated plan", () => {
    const life = createLife({ seed: 1 });
    const plan = LIFE_BOTS.planner(() => 0, life);
    const played = placeFitting(life, planPlacements(plan));
    expect(plannedChoices(played).total).toBe(best);
    expect(bestPlacements(life)).toBe(plan.placements);
  });

  it("leaves the naive smarter bot no better than the planner, and the risky bot behind", () => {
    const life = createLife({ seed: 1 });
    const total = (bot: string) =>
      plannedChoices(
        placeFitting(life, planPlacements(LIFE_BOTS[bot](() => 0, life))),
      ).total;
    expect(total("smarter")).toBeLessThanOrEqual(best);
    expect(total("planner")).toBe(best);
    expect(total("risky")).toBeLessThan(total("smarter"));
    expect(total("careless")).toBeLessThan(total("risky"));
    expect(total("forgetful")).toBeLessThan(total("smarter"));
  });
});
