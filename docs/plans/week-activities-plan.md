# Week activities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each week deals its own hand of activities from a shared pool, with four new hazard activities (woodworking, crawlspace, flytrap, and a day-3 trip) and one new germ, Burkholderia.

**Architecture:** `handFor(week)` in `src/sim/life/cards.ts` becomes a table lookup into a pool of card ids. New cards are entries in the existing `TEXT` map and `PARAMS.life.cards`. The trip adds one placement flag, `lastDayOnly`, next to `overnight` and `eveningOnly`. Burkholderia is a new `PathogenKindId` (a sealed bacterium) with a rod look; every record keyed by kind grows an entry.

**Tech Stack:** TypeScript, Vitest, three.js renderers, Vite. Node via mise: run everything with `mise exec -- npx vitest run <file>` and finish with `mise run check`.

**Spec:** `docs/specs/week-activities-design.md` (clinician items 1.1, 1.4, 3.1 to 3.3, 5.1 and 7 in `docs/specs/clinician-brief-nih.md` have the working assumptions).

## Global Constraints

- Work on a branch `feat/week-activities` (main is the default branch). Conventional commits. Do not tag or bump the version; releasing is Tracy's call.
- Week 1's hand is unchanged: `["yard", "lake", "band", "sleepover", "game"]`. Week 1 balance numbers must not move.
- Week 2's hand is `["band", "wood", "crawl", "flytrap", "trip"]`; only band repeats. Weeks past the table reuse the last row.
- A hand card has at most two versions (risky, smarter): the card UI, `cardPreview` and the bots assume it. No third version, no re-gift.
- The trip (`trip`, smarter `tripPlan`) is placeable only in day 3's evening slot. It has no pill slip. It is labeled "Leave for Vietnam".
- Burkholderia: `wall: "sealed"`, `form: "bacterium"`, `canSpore: false`. Fights in the lung. An antibacterial charge covers it (`chargeCovers` is keyed on form). Antifungal does not.
- No marijuana and no koji card. Koji is not in the pool.
- Player-facing text says "disease", never "character". Organism names reach the player only through `src/sim/organisms.ts` (`organisms.test.ts` fails on a pathogen word in a literal elsewhere). Color never carries meaning alone: every germ and card also has a shape or icon.
- Doctor and treatment copy stays light; depict no procedures.
- Run Prettier on the files you edit (`mise exec -- npx prettier --write <files>`), not `mise run format`.
- Tiles for `PARAMS.life.cards.*.at` must be valid on the lung map; the `validateBattle` test in Task 4 enforces it. Reuse tiles already used by existing cards: (5,0), (1,0), (3,0), (6,2), (0,2), (6,1).

## Review Focus

Failure modes the spec implies that a person could hit; each has a test in the named task.

1. **A week-2 state saved with the old hand** (a life whose `hand` is the week-1 five, in week 2) still plays, because old ids stay in the pool. (Task 4)
2. **Trip and the doctor on day 3.** The doctor stays placeable in day 3's day slot; placing the trip over a doctor already in the evening replaces it, as any card does. (Task 3)
3. **Trip with too little energy** gives the existing "not enough energy" problem, not a crash, and a day-slot rest before it can make it affordable. (Task 3)
4. **A Burkholderia reservoir carried to the next week** survives the carry and shows as a "soreSpot" symptom (bacterium), not "lowFever". (Task 1)
5. **Long labels on a phone.** "Leave for Vietnam, with a travel plan" must not overflow a card at 375px width. (Task 7, manual)

---

### Task 1: Burkholderia in the sim

**Files:**
- Modify: `src/sim/pathogens.ts`, `src/sim/organisms.ts`, `src/sim/params.ts` (the `intents` block, near line 54-80), `src/sim/life/preview.ts` (the `expected` record, near line 98), `src/theme/palette.ts`, `src/ui/hud.ts` (`GERM_COLOR_WORD`), `src/render/pathogenView.ts` (the `mats` record and `KIND_COLOR`), `src/render/insetView.ts` (the `bodies` record and `used` counter)
- Test: `src/sim/organisms.test.ts`, `src/sim/battle/support.test.ts`, `src/sim/life/life.test.ts`

**Interfaces:**
- Produces: `PathogenKindId` now includes `"burkholderia"`. `PATHOGEN_KINDS.burkholderia` is `{ wall: "sealed", form: "bacterium", canSpore: false }`. Palette tokens `burkholderia` and `burkholderia-ink`. `organismName("burkholderia")` is `"Burkholderia"`. `GERM_COLOR_WORD.burkholderia` is a color word not used by the other three (Orange, Teal, Violet); use "Rose".

- [ ] **Step 1: Write the failing tests**

In `organisms.test.ts` (the existing `KINDS` loop already covers every kind): add
```ts
expect(organismName("burkholderia")).toBe("Burkholderia");
expect(organismShort("burkholderia")).toBe("Burkholderia");
expect(organismKeyText("burkholderia")).toBe("Burkholderia, a bacterium");
expect(organismDescription("burkholderia")).toMatch(/shell/);
```
In `support.test.ts`: `chargeCovers("antibacterial", "burkholderia")` is true, `chargeCovers("antifungal", "burkholderia")` is false, `chargeCovers("strong", "burkholderia")` is true.
In `life.test.ts`, test `"carries a Burkholderia reservoir as a sore spot"`: build a life with `createLife({ seed, reservoirs: [{ kind: "burkholderia", size: 1 }] })` (copy the shape of the existing `STAPH1` fixture in `campaign.test.ts`), and expect its symptom `kind` to be `"soreSpot"`.

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/sim/organisms.test.ts src/sim/battle/support.test.ts src/sim/life/life.test.ts`
Expected: FAIL (type errors, unknown kind).

- [ ] **Step 3: Implement**

- `pathogens.ts`: add the `burkholderia` entry.
- `organisms.ts`: name "Burkholderia", scientific "Burkholderia", short "Burkholderia", description "a rod-shaped bacterium in a shell, found in soil and muddy water". Species is deliberately not named (clinician item 32).
- `params.ts`: `intents.burkholderia` copies `staph`'s numbers exactly (a slow sealed abscess). Add a one-line comment saying so and pointing at clinician items 33 to 35.
- `palette.ts`: `burkholderia` and `burkholderia-ink`, a rose/pink-red hue distinct from orange `#F0A843`-ish strep, teal staph and violet aspergillus, and not the card colors; check it against the grayscale note in `b7-accessibility-design.md`.
- `hud.ts`, `preview.ts`, `pathogenView.ts`, `insetView.ts`: add the missing record entries so TypeScript compiles; for now reuse staph's geometry and material settings (Task 2 gives it a rod look). `insetView`'s `used` counter gains a `burkholderia: 0` field.

- [ ] **Step 4: Run to verify pass**

Run: `mise run typecheck && mise exec -- npx vitest run src/sim`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/week-activities
git add src docs
git commit -m "feat(sim): add Burkholderia, a sealed bacterium"
```

---

### Task 2: The rod look

Burkholderia and Staph are both sealed bacteria. They must differ by more than color.

**Files:**
- Modify: `src/sim/pathogens.ts` (add `look`), `src/render/pathogenView.ts` (`buildBody`), `src/render/telegraphView.ts` (the `def.form === "bacterium"` block near line 292), `src/render/insetView.ts` (burkholderia bead geometry), `src/ui/hud.ts` and `src/ui/lifePanel.ts` (key rows), `src/ui/help.ts` (the Engulfing paragraph)
- Test: `src/sim/organisms.test.ts` (or a new `src/sim/pathogens.test.ts`)

**Interfaces:**
- Produces: `PathogenKindDef.look?: "rod"`. Only `burkholderia` sets it. Renderers draw a rod (a straight line of three beads, or one stretched bead for the inset) where a plain bacterium is a three-bead triangle. Key text says "rod-shaped dots" for rods.

- [ ] **Step 1: Write the failing test**

```ts
it("gives only Burkholderia a rod look", () => {
  const rods = KINDS.filter((k) => PATHOGEN_KINDS[k].look === "rod");
  expect(rods).toEqual(["burkholderia"]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/sim/organisms.test.ts` Expected: FAIL.

- [ ] **Step 3: Implement**

Add `look` to `PathogenKindDef`. `pathogenView.buildBody` and `telegraphView` choose the rod layout when `def.look === "rod"`. The 2D key rows (`hud.ts` near line 399, `lifePanel.ts` near line 238) draw a pill (`border-radius:50%` with width about 1.6x height) and say "rod-shaped dots"; the sealed ring still applies. `help.ts` Engulfing text lists Burkholderia among the shelled germs using `organismName("burkholderia")`, never a literal.

- [ ] **Step 4: Verify**

Run: `mise run typecheck && mise exec -- npx vitest run src/sim/organisms.test.ts && mise run lint`
Expected: PASS. Then start `pitchfork start web`, open http://localhost:5199/ with a scenario that contains a burkholderia (a debug link or a temporary scenario you remove again), and check the rod beside a Staph at battle size, in the key, and in grayscale (browser dev tools "emulate vision deficiency: achromatopsia"). The rod must read apart from Staph without color.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(ui): draw Burkholderia as a rod so color is not the only cue"
```

---

### Task 3: The trip card and the last-day rule

**Files:**
- Modify: `src/sim/life/types.ts` (`CardId`, `HandCardId` add `"trip" | "tripPlan"` and `"trip"`), `src/sim/life/cards.ts` (`CardText.lastDayOnly`, `TEXT.trip`, `TEXT.tripPlan`), `src/sim/params.ts` (`life.cards.trip`, `life.cards.tripPlan`), `src/sim/life/calendar.ts` (`placementProblems`, near line 239), `src/sim/life/preview.ts` if the preview should say why
- Test: `src/sim/life/life.test.ts`

**Interfaces:**
- Consumes: `CardText`, `placementProblems(life, day, slot, card): string[]`.
- Produces: `CardText.lastDayOnly?: boolean`. Both trip versions set `eveningOnly: true` and `lastDayOnly: true`, `kinds: ["burkholderia"]`, `base: "trip"`; `trip.smarter = "tripPlan"`. A problem string `"the trip leaves on the evening of day 3"` is added when `lastDayOnly` and `day !== L.days - 1`. Labels: `trip` "Leave for Vietnam", `tripPlan` "Leave for Vietnam, with a travel plan". Blurbs name the hazard as soil and muddy water, not the country, and read as trouble on the way or in the first days. `PARAMS.life.cards`: `trip` { points 6, energy 3, chance 0.45, size 2, count 1, at from the reused tiles }, `tripPlan` { points 5, energy 3, chance 0.12, size 1, count 1, same tile }. These are starting numbers; Task 6 tunes them.

- [ ] **Step 1: Write the failing tests** (in `life.test.ts`; build the life with `{ ...createLife({ seed: 1 }), hand: [...handFor(1), "trip"] }`)

```ts
it("places the trip only in day 3's evening", () => {
  const life = withTrip();
  expect(placementProblems(life, 0, 1, "trip")).toContain("the trip leaves on the evening of day 3");
  expect(placementProblems(life, 1, 1, "trip").length).toBeGreaterThan(0);
  expect(placementProblems(life, 2, 0, "trip").length).toBeGreaterThan(0); // evening only
  // Energy: rest first on day 3's day slot so the evening trip is affordable.
  const rested = /* put rest/unplaced day 0-1 so energy >= 3 */;
  expect(placementProblems(rested, 2, 1, "trip")).toEqual([]);
});
it("leaves day 3's day slot to the doctor, and lets the trip replace a doctor in the evening", () => { /* doctor at (2,0) stays valid; place doctor at (2,1) then trip at (2,1): placeCard replaces it */ });
it("rejects the trip with too little energy rather than crashing", () => { /* energy below 3 gives ["not enough energy"] among problems */ });
it("brings Burkholderia when the trip lands", () => { expect(exposureKind("trip", 0)).toBe("burkholderia"); expect(cardDef("trip").exposure.kinds).toEqual(["burkholderia"]); });
```
Fill in the energy setup using `energyPlan` as the existing "rejects a plan whose energy would go below zero" test does.

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/sim/life/life.test.ts` Expected: FAIL.

- [ ] **Step 3: Implement** the flag, the two cards, the params and the placement rule. The `eveningOnly` message ("game night is only in the evening") names game night; generalize it to use `def.label` or give it the card's own wording so the trip does not say "game night".

- [ ] **Step 4: Run to verify pass**

Run: `mise exec -- npx vitest run src/sim/life` Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(sim): add the day-3 trip card and a last-day placement rule"
```

---

### Task 4: Woodworking, crawlspace, flytrap and the per-week hands

**Files:**
- Modify: `src/sim/life/types.ts`, `src/sim/life/cards.ts` (`TEXT`, `HAND`, `handFor`, new `POOL`), `src/sim/params.ts` (`life.cards`)
- Test: `src/sim/life/life.test.ts`, `src/sim/campaign.test.ts`, `src/sim/score.enumeration.test.ts`

**Interfaces:**
- Produces: `CardId` gains `wood`, `woodDry`, `crawl`, `crawlRake`, `flytrap`, `flytrapGarage`. `HandCardId` gains `wood`, `crawl`, `flytrap`. `export const POOL: readonly HandCardId[]` lists every non-doctor hand card (yard, lake, band, sleepover, game, wood, crawl, flytrap, trip). `handFor(week: number): readonly HandCardId[]` returns the week-1 five for week 1, `["band","wood","crawl","flytrap","trip"]` for week 2, and week 2's hand for any later week (and for week 0 or below, week 1's).
- Starting numbers, which satisfy the existing test that a smarter card keeps at least 75% of the risky points, with strictly lower odds and `size * count`:

| id | points | energy | chance | size | count |
| --- | --- | --- | --- | --- | --- |
| wood | 5 | 2 | 0.40 | 2 | 1 |
| woodDry | 4 | 2 | 0.10 | 1 | 1 |
| crawl | 4 | 1 | 0.35 | 2 | 1 |
| crawlRake | 3 | 1 | 0.09 | 1 | 1 |
| flytrap | 4 | 1 | 0.35 | 2 | 1 |
| flytrapGarage | 3 | 1 | 0.10 | 1 | 1 |

All six bring `kinds: ["aspergillus"]`. Labels: "Green woodworking with Dad" / "Dry wood, outside"; "Crawlspace for the ball" / "Hook the ball out with a rake"; "Keep the flytrap in your room" / "Flytrap in the garage". The flytrap's garage blurb says the garage is out of the living space and beside Dad's wood pile, which you should stay away from anyway. Copy follows the project's voice (`people` line names who asks; blurb names the hazard in plain words; "disease", not "character").

- [ ] **Step 1: Write the failing tests**

```ts
it("deals each week its own hand, repeating only band practice in week 2", () => {
  expect(handFor(1)).toEqual(["yard", "lake", "band", "sleepover", "game"]);
  expect(handFor(2)).toEqual(["band", "wood", "crawl", "flytrap", "trip"]);
  expect(handFor(2).filter((c) => handFor(1).includes(c))).toEqual(["band"]);
  expect(handFor(3)).toEqual(handFor(2));
  expect(handFor(0)).toEqual(handFor(1));
});
it("keeps every pool card in the pool, with tiles and odds that are valid", () => {
  for (const id of CARD_IDS) { /* chance in [0,0.5), size >= 1, at tiles within the board, kinds non-empty except doctor */ }
});
it("pays more for the risky version, keeping most of it in the smarter one, for every pool card", () => {
  /* the existing test, looping POOL instead of HAND(week 1) */
});
it("still plays a week-2 life that was saved with the week-1 hand", () => {
  const life = createLife({ seed: 3, week: 2 });
  const old = { ...life, hand: handFor(1) };
  expect(() => finish(placeCard(old, 0, 0, "yard").state)).not.toThrow();
});
it("lets a week-2 life run to a battle that validates when the trip lands", () => {
  /* find a seed whose trip roll lands (cardRoll(seed, 2, "trip") < cardDef("trip").exposure.chance), place trip at (2,1), finish, then validateBattle(battleFromLoadout(loadoutFromLife(life))) is clean and the loadout contains a burkholderia */
});
```
In `campaign.test.ts` add: a campaign advanced to week 2 has `life.hand` equal to `handFor(2)`.
In `score.enumeration.test.ts`, the file hard-codes `HAND = handFor(1)`; keep it for week 1 and add a week-2 enumeration only if it runs in under a few seconds; otherwise leave week 2 to Task 6.

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/sim/life/life.test.ts src/sim/campaign.test.ts` Expected: FAIL.

- [ ] **Step 3: Implement** the ids, `TEXT` entries, `PARAMS.life.cards` entries, `POOL`, and the `handFor` table (a `HANDS: Record<number, readonly HandCardId[]>` plus the clamp rule). Remove the stale comment and the `eslint-disable` on `handFor`. Update the doc comment on `HAND`/`handFor`.

- [ ] **Step 4: Run to verify pass**

Run: `mise exec -- npx vitest run src/sim` Expected: PASS except balance targets, which Task 6 owns (if a week-1 number moved, stop: week 1 must not change).

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(sim): deal each week its own hand with three new hazard activities"
```

---

### Task 5: Card art

**Files:**
- Modify: `src/ui/cardStyle.ts` (`CardFamily`, `CARD_FAMILY`, `CARD_ICON`), `src/theme/palette.ts` (four family colors and tints)
- Test: create `src/ui/cardStyle.test.ts`

**Interfaces:**
- Produces: families `wood`, `crawl`, `flytrap`, `trip`; tokens `card-wood`, `card-wood-bg`, `card-crawl`, `card-crawl-bg`, `card-flytrap`, `card-flytrap-bg`, `card-trip`, `card-trip-bg`. Every `CardId` has a family and an icon.

- [ ] **Step 1: Write the failing test**

```ts
it("gives every card id a family, an icon and palette tokens", () => {
  for (const id of CARD_IDS) {
    expect(CARD_FAMILY[id], id).toBeDefined();
    expect(CARD_ICON[id], id).toBeTruthy();
    expect(PALETTE[cardAccent(id)], id).toBeDefined();
    expect(PALETTE[cardTint(id)], id).toBeDefined();
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/ui/cardStyle.test.ts` Expected: FAIL (the fallback to "rest" hides missing art today; the test asserts the family is defined).

- [ ] **Step 3: Implement.** 24x24 outline icons in the existing style (stroke, `currentColor`): one per card id, a smarter version of each family as a variant of the family icon, as `yardIndoor` is. Suggested: wood a saw or log, crawl a ball and a low arch, flytrap a leaf with a toothed edge (garage: a door), trip a suitcase or plane. Colors: bright accent plus dark tint, not green, teal or mint (medication) and not the germ colors (comment at the top of the palette block), distinct from the five existing card colors.

- [ ] **Step 4: Run to verify pass**

Run: `mise exec -- npx vitest run src/ui/cardStyle.test.ts && mise run typecheck` Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(ui): add icons and colors for the new activities"
```

---

### Task 6: Bots, week-aware balance, and tuning

The fixed-shape bots place week-1 cards in `SLOTS`. In week 2 they would skip every card except band practice, so campaign and balance results would be wrong.

**Files:**
- Modify: `src/sim/life/bots.ts` (`bestPlacements`, `playWeek`, `LIFE_BOTS`), `src/sim/campaignBots.ts` (the `cheapest` list near line 122), `src/sim/params.ts` (tuning)
- Test: `src/sim/life/balance.test.ts`, `src/sim/campaign.balance.test.ts`

**Interfaces:**
- Produces: `bestPlacements(life: LifeState, versions?: "any" | "risky" | "smarter"): readonly Placement[]` (default `"any"`; cache key includes `versions`). `playWeek(bot: LifeBot, seed: number, week = 1): LifeState` creates the life with `createLife({ seed, week })`. For any life whose hand is not `handFor(1)`, the bots `risky`, `mixed`, `forgetful`, `smarterSkipMeds` and `riskySkipMeds` return `placements: bestPlacements(life, "risky" | "smarter")` instead of a fixed shape (week 1 keeps its fixed shapes so its numbers do not move). `survey(name, week)` in the balance test takes the week.

- [ ] **Step 1: Write the failing tests** (a `describe("week 2 strategies into battle")` mirroring the week-1 block; same `SEEDS = 400`)

```ts
it("lets the best plan reach the goal in at least 90% of weeks", () => { expect(rows.smarter.goal).toBeGreaterThanOrEqual(0.9); });
it("lets the all-risky plan reach it less often, between 55% and 85%", () => { expect(rows.risky.goal).toBeGreaterThanOrEqual(0.55); expect(rows.risky.goal).toBeLessThanOrEqual(0.85); });
it("cannot reach the goal with the all-smarter versions alone", () => { /* plannedChoices total of the best all-"smarter" plan < goal target (13) */ });
it("scores the risky plan below the smarter one", () => { expect(rows.risky.score).toBeLessThan(rows.smarter.score); });
it("makes the trip the best-paying and riskiest card of the hand", () => { /* cardDef("trip").points and exposure.chance are the max over handFor(2) */ });
```
Also a test that `playWeek(LIFE_BOTS.risky, seed, 2)` places at least the trip and two others for some seed (the fixed shape no longer drops them).

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/sim/life/balance.test.ts` Expected: FAIL.

- [ ] **Step 3: Implement** the bot changes, then **tune**: run `mise exec -- npx vitest run src/sim/life/balance.test.ts --silent=false` for the table, and adjust only `PARAMS.life.cards` for the six-plus-two new ids (points, energy, chance, size, count) until the targets above hold. Do not touch week-1 cards. Record the final week-2 table in the commit message body. Update the `campaignBots` `cheapest` list so the doctor can displace any hand card, not only the week-1 five (use `life.hand` minus the doctor, cheapest by energy).

- [ ] **Step 4: Run to verify pass**

Run: `mise exec -- npx vitest run src/sim` Expected: PASS, with week-1 rows identical to before the change (compare against `git stash`ed output if unsure).

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "test(sim): balance week 2 and make the bots week-aware"
```

---

### Task 7: The life screen

**Files:**
- Modify: `src/app/lifeModel.ts` (the reasons mapping near line 164), `src/app/lifeScreen.ts` and `src/ui/lifePanel.ts` only if the screen assumes five fixed cards or a card order
- Test: `src/app/lifeModel.test.ts`

**Interfaces:**
- Consumes: `placementProblems` strings from Task 3. The player-facing reason for the trip is "The trip leaves on the evening of day 3."

- [ ] **Step 1: Write the failing test** in `lifeModel.test.ts`, following its `fresh()` and `put()` helpers: with the trip in hand, tapping day 1's evening with the trip selected yields the trip's reason (not a raw problem string, not "game night"), and day 3's evening places it.

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/app/lifeModel.test.ts` Expected: FAIL.

- [ ] **Step 3: Implement.** Read `lifeModel.ts` around line 150-190 to see how raw problems become player text, and add the trip's. Search `lifeScreen.ts` and `lifePanel.ts` for anything keyed to the five week-1 cards or a hand length of 5.

- [ ] **Step 4: Verify**

Run: `mise run check` Expected: PASS. Then `pitchfork start web`, open http://localhost:5199/, play to week 2 and check by eye: the five cards, their two versions, the trip refused on days 1 and 2 with its reason, the trip accepted on day 3's evening, a Burkholderia fight after it lands, and the key listing the rod. Do this at 375px width (Review Focus 5): no label overflows a card. Stop the daemon when done.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat(ui): explain why the trip only goes in day 3's evening"
```

---

### Task 8: Docs and the final check

**Files:**
- Modify: `CHANGELOG.md`, `docs/plans/beta-plan.md` (the "Backlog: a larger card pool drawn per week" line and the B1d slice 5 mention), `docs/specs/week-activities-design.md` (status line: built)
- (`.codesight` regenerates in the pre-commit hook.)

- [ ] **Step 1:** Add a CHANGELOG entry under the unreleased heading (match the file's style): per-week hands, four new activities, Burkholderia, the trip rule.
- [ ] **Step 2:** In `beta-plan.md`, change the backlog line to say each week now deals its own authored hand from a pool, and that a seeded draw is still open.
- [ ] **Step 3: Run the whole check**

Run: `mise run check` Expected: typecheck, lint, format:check, test and build all pass.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md docs
git commit -m "docs: record per-week hands and the new activities"
```

Hand back to Tracy for review. Releasing (version bump and `v` tag) is a separate decision.
