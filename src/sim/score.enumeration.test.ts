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
          if (placementProblems(life, day, slot, v).length > 0) continue;
          walk(i + 1, placeCard(life, day, slot, v).state, [
            ...cards,
            `${v}@${day}.${slot}`,
          ]);
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

  // At goal 13 the best plan takes the risky game night (a late night, 50% to slip a dose) to reach
  // the goal, so a late-night game night is no longer excluded; it is the one risky card.
  it("takes at most one late night in a best plan", () => {
    for (const t of top) {
      const l = t.life;
      let late = 0;
      for (let d = 0; d < PARAMS.life.days; d++) {
        if (slipChanceFor(l, d) !== null) late++;
      }
      expect(late, t.cards.join(" ")).toBeLessThanOrEqual(1);
    }
  });

  it("has goal-meeting plans that are a minority but not rare", () => {
    const share = plans.filter((p) => p.points >= goal).length / plans.length;
    // Measured at goal 13: 4272 of 37949 plans (11%).
    expect(share).toBeGreaterThan(0.05);
    expect(share).toBeLessThan(0.3);
  });

  it("leaves more than one plan within 10% of the best", () => {
    expect(plans.filter((p) => p.choices >= 0.9 * best).length).toBeGreaterThan(
      1,
    );
  });

  it("scores the design's all-smarter worked example 256 at goal 13 (296 with the goal bonus at 12)", () => {
    let l = createLife({ seed: 1 });
    for (const [day, slot, card] of [
      [0, 0, "yardIndoor"],
      [0, 1, "sleepover"],
      [1, 1, "beach"],
      [2, 1, "gameEarly"],
    ] as const)
      l = placeCard(l, day, slot, card).state;
    const c = plannedChoices(l);
    (
      globalThis as unknown as { console: { log(s: string): void } }
    ).console.log(`worked example: ${JSON.stringify(c)}`);
    expect(c.goalMet).toBe(0);
    expect(Math.abs(c.total - 256)).toBeLessThanOrEqual(5);
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
    expect(total("forgetful")).toBeLessThanOrEqual(total("smarter"));
  });
});
