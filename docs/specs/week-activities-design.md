# Week activities: a hand for each week, and new hazards

Status: draft for approval, 2026-11-16. Design only; nothing is built.

## Intent

Every week deals the same five activities, which is repetitive and lowers the fun. Each week should
deal its own hand from one shared pool of activities. The pool should also teach a variety of
hazards, because part of what the game teaches a patient with CGD is the different ways a germ
reaches you (breathing spores, soil and dust, water, travel), not one hazard in five costumes.

Success looks like: week 2 feels like a different week, not a rerun; a player can name more kinds of
hazard after playing than before; and the week goal still takes real choices to reach.

## Goals

- Each week names its own hand of five. A card may appear in more than one week, but we keep repeats
  rare: week 2 repeats only band practice.
- Four new activities, so the pool grows from five (plus the doctor) to nine:
  green woodworking with Dad, the crawlspace and the soccer ball, the gift flytrap, and the senior
  trip ("Leave for Vietnam").
- One new germ, Burkholderia, brought by the trip.
- A "last day, evening only" placement rule for the trip, so nothing is scheduled after leaving.

## Non-goals

- No random or seeded draw of hands (a possible later step; see Approaches).
- No Salmonella and no reptile pet yet. Its site (gut, liver or blood, not the lung) and shell are
  open clinician items 38 and 39. Burkholderia is first because it fits the lung map.
- No koji card. The danger is uncertain (clinician item 43c), so it stays out of the build.
- No marijuana, ever (decided with Tracy).
- No pill slip for the trip, and no multi-day trip. The trip is one card on day 3.
- No new fight sites or maps. Burkholderia fights in the lung, like everything else today.
- No change to week 1.

## Anti-goals

- A week 2 that is trivially easier or harder than week 1 (see Constraints).
- A hazard that teaches the wrong lesson, for example that a place or its people are the danger,
  rather than the soil, water or dust.
- Player text that says "character" (it says "disease"), or depicts a procedure.

## Constraints

- **Clinician answers are not available until the demo.** Tracy's call: build from the working
  assumptions in `clinician-questions.md` items 32 to 43. Wrong is fine; it will be corrected before
  patients play. Every new card and Burkholderia's behavior must be easy to change.
- **The week goal** is 13 points (`PARAMS.life.goalTarget`). Today the smarter bot meets it in 95% of
  weeks and the risky bot in 75% (`balance.test.ts`). Week 2 should land near those numbers.
- The week has 3 days with 2 slots each (6 slots), 5 cards plus rest, and energy (start 5, max 6,
  rest gives 1).
- The sim is pure data and plain JSON (`banned-in-sim.ts`). Organism names reach the player only
  through `src/sim/organisms.ts` (a test fails otherwise).
- Every full-screen card sets a scene or sits over the board (see CLAUDE.md, UI rules). No screen is
  monochrome, and color is never the only way to tell two germs apart (B7 accessibility).

## Approaches considered

1. **Authored hands (chosen).** `handFor(week)` returns a hand written for that week from the shared
   pool. Easy to tune and test, matches how Tracy described it. Variety comes from what we write.
2. **Seeded random draw.** Replays differ, but every hand must still make the goal reachable, so the
   draw needs rules and the balance tests must cover every seed. Too much work for a 2-week campaign.
3. **Slot-based draw.** Hands have fixed roles (one yard-type hazard, one water, and so on) drawn
   within each role. Balanced and varied, but it needs a larger pool first.

The data shape (a pool plus a hand per week) lets 2 or 3 be added later without rework.

## Design

### The hands

| Week | Hand                                                                         |
| ---- | ---------------------------------------------------------------------------- |
| 1    | yard, lake, band, sleepover, game (unchanged)                                |
| 2    | band, woodworking, crawlspace, flytrap, trip (only band repeats from week 1) |

Weeks past the table reuse the last row (a campaign is 2 weeks today, so this is a guard only).
Koji is not built; the pool is the nine activities above plus the doctor.

### The new activities

Each follows the existing pattern: a risky card and a smarter version, picked on the card, with
points, energy, landing odds and an entry tile in `PARAMS.life.cards`. Ids follow the existing naming
(`yard` and `yardIndoor`). Wording and the smarter versions are my proposal; the numbers are
starting points for the builder to tune against the goal.

| Activity (id / smarter id)                         | Hazard and how it reaches you                   | Germ         | Start odds / points / energy |
| -------------------------------------------------- | ----------------------------------------------- | ------------ | ---------------------------- |
| Green woodworking with Dad (`wood` / `woodDry`)    | Damp wood and sawdust, breathed in              | Aspergillus  | 40% / 5 / 2                  |
| Crawlspace for the ball (`crawl` / `crawlRake`)    | Damp soil, old mold and dust in a tight space   | Aspergillus  | 35% / 4 / 1                  |
| Gift flytrap (`flytrap` / `flytrapGarage`)         | Damp potting soil and moss kept in the house    | Aspergillus  | 35% / 4 / 1                  |
| Leave for Vietnam (`trip` / `tripPlan`), day 3 evening only | Warm soil and muddy water on a trip abroad      | Burkholderia | 45% / 6 / 3                  |

Smarter versions, as proposed: woodworking with dry wood outdoors; the crawlspace with a rake to
hook the ball out; the flytrap moved to the garage next to Dad's wood pile, out of the living space (and next to a hazard the player should already avoid, so there is no reason to go near it; also the better social play if the person who gave it finds out). Re-gifting would also be safer than keeping it in the house, but the card UI, preview and bots assume exactly two versions of a card, so it is not built; the trip with a travel
plan (closed shoes, no floodwater, bottled water; clinician item 36). Smarter odds are about a
quarter of the risky odds and points a step lower, as the existing pairs are.

### The trip: last day, evening only

Two existing flags and one new one. `eveningOnly` already exists; the new `lastDayOnly` is the mirror
of `overnight` (which excludes the last day). Placement rules live in one place (`calendar.ts`, near
the `overnight` and `eveningOnly` checks). So the trip goes in day 3's evening slot only. That is
the last slot of the week, so nothing can be scheduled after leaving, and it needs no new "locked
slot" logic. It competes for that evening with the late-night game (also evening only); the doctor can still use
day 3's day slot.

Tracy first allowed either day 3 slot. A trip in the day slot would have to lock the evening, and it
would almost never beat the evening slot (the day slot could hold an activity or a rest before the
trip). If we want the day slot later, it is a small change: drop `eveningOnly` and lock the slot
after it.

Because the battle follows day 3 directly, the card text must read as trouble on the way or in the
first days of the trip, not as a week of travel. The trip is in week 2, the last week, so nothing
carries into a later week. The card says what the hazard is (soil and water), not that the country
is dangerous. Naming Vietnam is Tracy's call and stays as Tracy chose.

The preview and the placement error must say why the card won't go elsewhere ("The trip leaves on
the evening of day 3").

### Burkholderia

A new `PathogenKindId`, `burkholderia`: a sealed bacterium (`wall: "sealed"`, `form: "bacterium"`,
`canSpore: false`), so engulfing only contains it and a full week of antibacterial charge finishes a
small one, like Staph. These are clinician items 33 to 35; working assumptions until answered.

Everything keyed by `PathogenKindId` must grow. TypeScript will list most of them; the known ones:
`pathogens.ts`, `organisms.ts` (name, scientific, short, description), `palette.ts` (a color and an
ink), `hud.ts` (color word), the key in `lifePanel.ts`, the line in `help.ts`, the renderers
(`pathogenView.ts`, `insetView.ts`), `scenarios.ts` and `campaignModel.ts`. Its look must differ from
strep, staph and Aspergillus by more than color (a shape or mark), and pass the grayscale check.

### Other changes

- Card art for the four new activities: an icon and a color in `cardStyle.ts` and `palette.ts`.
- Bots (`bots.ts`) and balance tests (`balance.test.ts`, `campaign.balance.test.ts`) cover week 2.
- Tests: each hand has five distinct pool cards; `handFor` per week; the trip is refused on days 1
  and 2 and in day 3's day slot, and accepted in day 3's evening; a week-2 life runs to a battle with Burkholderia.
- `CHANGELOG.md` and the backlog line in `docs/plans/beta-plan.md` ("a larger card pool drawn per
  week") updated. Wiki regenerates in the pre-commit hook.

## Decisions Tracy made

- Per-week authored hands (approach 1).
- New hazards, not new settings for old ones; Burkholderia first, built now from working assumptions.
- Marijuana removed. Koji left out for now. Flytrap in, koji out of week 2.
- Week 2 repeats only band practice. Few repeats until later campaigns.
- The trip is placeable only on day 3 and is labeled "Leave for Vietnam". Nothing is scheduled after it.
- Indoor plants in damp soil are not recommended for CGD. The flytrap's smarter version is the garage by Dad's wood pile: outside the living space, so most of the risk dissipates. Re-gifting is also safer than keeping it in the house, and is not built (two versions per card).

## My calls (check these)

- Week 1 stays as is. Week 2 has the five cards in the table above.
- Weeks past the table reuse the last hand.
- Card ids, smarter versions and starting numbers above.
- The trip is day 3, evening slot only (a change from Tracy's "either slot", to satisfy "nothing after leaving" without new logic), and has no pill slip.
- Flytrap odds: 35% in the house, about 10% in the garage (still damp soil to move and water, so not zero).
- Burkholderia is drawn as a sealed bacterium with a distinct mark, not a new silhouette family.
- The spec lives in `docs/specs/` (the project's convention), not `docs/superpowers/specs/`.

## Left to the builder

- Final numbers (odds, size, count, points, energy, entry tiles), tuned so week 2 meets the goal at
  about the week-1 rates. The trip should be the best-paying card of the hand and the riskiest.
- Card copy in the project's voice, plain and not frightening, with "disease" for player text.
- Burkholderia's color, mark and info-card text.
- Whether saved life state with an old hand needs handling (check `validate.ts` and any saved game).
- Which test files need a week-2 case beyond those named.

## Open and not blocking

Clinician items 32 to 43 in `clinician-questions.md`. The build uses their working assumptions and
changes later if the answers differ.
