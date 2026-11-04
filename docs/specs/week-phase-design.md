# Week phase: design pass

Design-only pass after Tracy's playtest of week 2 ("still trivial to play and win"; "odd that taking
medication is always on by default... a patient may forget, but would not deliberately decide not
to take them"). No code was changed. Numbers come from `src/sim/params.ts` on `feat/beta` at
`655f987`, from `src/sim/score.balance.test.ts` and `src/sim/battleDepth.balance.test.ts` (run as
they stand), and from two throwaway scripts: a 300-seed campaign survey that records the life state
of each week, and an exhaustive enumeration of every legal week plan (card subset, versions, pills,
slot order) checked with `placementProblems`. Clinical corrections in `fodder.md` win over everything
here: neutrophil count is never a lever, no interferon-gamma, there is always a battle, no game
over, curative therapies are not gameplay.

## 1. Diagnosis

### 1.1 What was measured

Per week (week 1 / week 2), 300 two-week campaigns, every battle played by `thoughtfulPlay`:

| Bot      | Goal met  | Energy at week start | Energy left at week end | At least one exposure landed | A symptom showed | Choices per week |
| -------- | --------- | -------------------- | ----------------------- | ---------------------------- | ---------------- | ---------------- |
| home     | 0% / 0%   | 5.0 / 6.0            | 6.0 / 6.0               | 0% / 0%                      | 27% / 30%        | 95 / 96          |
| careless | 100%/100% | 5.0 / 5.5            | 1.0 / 1.5               | 73% / 71%                    | 27% / 77%        | 140 / 140        |
| mixed    | 98% / 95% | 5.0 / 5.9            | 0.7 / 1.5               | 54% / 56%                    | 27% / 46%        | 240 / 242        |
| risky    | 100%/ 99% | 5.0 / 5.9            | 0.3 / 1.1               | 73% / 70%                    | 27% / 44%        | 233 / 231        |
| skipMeds | 100%/ 91% | 5.0 / 5.8            | 0.3 / 1.3               | 35% / 37%                    | 27% / 35%        | 190 / 189        |
| smarter  | 100%/100% | 5.0 / 6.0            | 0.3 / 1.3               | 35% / 37%                    | 27% / 31%        | 280 / 281        |

Campaign totals (score.balance, 200 seeds): home 391, careless 377, skipMeds 560, risky 642, mixed
658, smarter 760 (best 790). Battle link (battleDepth.balance): on matched seeds skipMeds loses 3.0
more tissue per full battle and clears 26 points less often than smarter, so doses already bite
inside the body.

Every legal plan for a fresh week: **54 plans** are legal at 5 energy, and the same 54 at 6 (a sixth
point of energy opens nothing new). **10 of 54 meet the goal.** One plan is best on Choices (all
smarter versions, pills packed: 275); the next is 20 behind. That plan is the same every week,
because the hand is the same every week.

### 1.2 Why the week is trivial (rule by rule)

1. **The same four cards every week, and they all fit.** `HAND` is fixed (`life/cards.ts:109-114`).
   All four cost 6, the pills 1 (`params.ts:244-295`, `:242`), and the week gives 5 to start plus 2
   rests (`params.ts:239-241`): exactly enough (`params.ts:217-219` says so). There is never a
   friend to say no to. Week 2 starts at the cap of 6 almost always (`weekRecovery: 4`,
   `params.ts:355`, `campaign.ts:334-341`), so the energy left over (2/6 in Tracy's screenshot) is
   simply wasted.
2. **The goal is met by placing the cards, with no dice and no trade-off.** The smarter week scores
   exactly 12 = `goalTarget` (`params.ts:238`); every bot that plays all four cards meets it 91-100%
   of weeks. The goal also pays nothing: the score never reads it (`score.ts:74-95`; `b1a-design.md`
   3.2 item 4 says so on purpose). "12/12 goal met" is the screen telling the player they won
   before anything happened.
3. **The smarter version dominates the risky one on every axis.** On Choices: Indoor jobs 65 vs
   mulch 40, beach 70 vs lagoon 50 (`perPoint` 10 and `perDodgedPercent` 1, `params.ts:398-399`,
   `score.ts:57-71`), and the card face prints both numbers (`b1a-design.md` 3.2 item 1). On
   Outcome: fewer exposures (35% vs 73% of weeks). The risky card's one extra life point buys
   nothing, because the goal is met either way. Pitch 4's "risky choices should be tempting and pay
   off in the moment" (`fodder.md:143`) is not true in the numbers.
4. **Every other choice is dominated too.** Packing the pills costs 1 energy that has no other use.
   Seeing the doctor early is as restful as the rest it replaces (`params.ts:381`) and pays 20.
   Slot positions do not matter except "sleepover in an evening, not the last day"
   (`calendar.ts:215-217`). The dose toggle (`calendar.ts:336-354`, `lifePanel.ts:352-380`) has no
   upside at all.
5. **Decisions that matter in a week: none.** A careful player faces about 9 taps: 4 placements
   (free), 2 versions (dominated), pack (dominated), 3 dose chips (dominated), plus the doctor in
   27-46% of weeks (dominated). Once found, the optimum never changes.
6. **A hidden lever.** Exposure dice are drawn per slot in calendar order (`calendar.ts:402-406`,
   "two draws per day whatever is placed"). Moving the lake from day 2 to day 3 on a replay of the
   same seed changes whether it lands. That is invisible luck in a game that promises "same seed,
   same dice", and it rewards slot-shuffling rather than thinking.

The battle is no longer the problem (`battle-depth-design.md`, built: 4.3-5.7 turns, skill and
doses visibly matter). The week is now the weak half of the hybrid, the risk `fodder.md:145` names.

### 1.3 Why the dose toggle reads wrong

- **It asks a question nobody asks.** Each day shows a chip that is "on" and can be tapped "off".
  The UI frames the dose as a daily decision. Real patients do not decide each morning whether to
  take prophylaxis; it is a routine, and the routine breaks.
- **It contradicts our own pitch.** `pitch-4.md:71-73`: "Meds as default, friction as event...
  Skipping happens through believable events (sleepover, pills in the other bag, nausea, exam
  week, 'I feel fine')". The toggle arrived in B1b (`beta-plan.md:97`) to replace the confusing
  "Take meds / Skip today" pair; it fixed the confusion but kept the deliberate-skip framing.
- **It is a dominated choice.** Skipping loses 30 Choices per dose (`params.ts:400`,
  `score.ts:83-85`), dims the aura, removes charges and makes arrivals one size bigger. The only
  reasons to tap it are curiosity or a test. A choice that is never right reads as a trap or a
  lecture.
- **Clinical reality (general knowledge, to be checked; see question 22 in section 6).** In teens
  and young adults on long-term daily medicines, most missed doses are unintentional: forgetting,
  and routine disruption (nights away, travel, late nights, weekends, busy days, the handover of
  responsibility from parents to the teen). Side effects (stomach upset), pill burden or taste,
  not wanting to take pills in front of friends, and "I feel fine" (the benefit of prophylaxis is
  invisible when it works) are the main intentional reasons, and they come with a reason, not a
  whim. For CGD, daily antibacterial and antifungal prophylaxis is lifelong, so adherence fatigue
  is real, but it plays out over months, not inside a two-week arc. One missed day of prophylaxis
  probably matters little in reality; the game already magnifies it so it is visible (bigger
  arrivals, `battle-depth-design.md` slice 3), which is a declared game rule. None of this touches
  the clinical corrections (neutrophil counts stay normal; meds act through the aura, charges,
  arrival size and the carried roll).

So: missed doses should **arise from life** (disrupted routine, shown as odds), and the player's
agency should be **protecting the routine through planning**, not choosing to skip.

## 2. Design principles for this audience

1. **The challenge is scarcity, never guilt.** The hard part of the week is "more friends asking
   than you have energy for". Saying no to someone is the decision; the copy treats every choice as
   a fair one.
2. **No visible dominated choices.** If one option is always right, it is not a choice: make it
   automatic (doses are taken by routine) or give it a real cost elsewhere (packing the pills eats
   energy a card could use). Each remaining choice should have at least two plans within about 10%
   of the best.
3. **Risky stays tempting.** The risky version pays more life points and sometimes nothing happens.
   The smarter version wins by a small, honest margin on Choices and a larger one on Outcome on
   average, not by a moral margin printed on the card.
4. **Medicine is the default; routine is what you protect.** The player never decides to skip.
   Disruptions put a dose at risk with printed odds; the fix sits on the card that causes it.
5. **No blame for misses or infections.** "Game night ran late and the evening pills slipped", never
   "you skipped". Exposures land whatever you do; the Outcome line keeps saying so.
6. **Legible cause and effect.** One disruption, one dose at risk, shown on that day's chip, with the
   card that caused it named. The battle already shows the effect (bigger arrivals, lower carried
   %).
7. **Replay rewards thinking.** Same seed, same dice, and dice tied to the card, not the slot, so a
   replay changes only what the player changed. The best plan should take a little counting to find
   the first time, and week 2 should depend on how week 1 went.
8. **Short and touch-first.** A week stays under two minutes and on one screen; at most five
   invitations; tap targets 44px; colour never alone (glyph plus word plus number).

## 3. Options

### Option A: A tight week (more invitations than energy, routine-based doses)

**Rules in plain language.**

- **Five invitations, six slots, energy for about four.** A fifth card joins the hand: **Game night
  at Alex's** (3 points, 1 energy, 5% strep, evening only), smarter version **Game night, home by
  11** (2 points). Packing the pills still costs 1. The full hand costs 8 against 5 energy plus
  rests, so every week the player drops at least one friend.
- **The goal pays.** Meeting the life-points goal (12) adds **+40** to Choices. The risky version's
  extra point can now be the one that reaches the goal.
- **Doses are taken by routine.** No toggle. Each day's chip shows the forecast: "routine" (taken),
  "pills at home" (an unpacked sleepover the night before: missed, as today) or "late night: 50% the
  pills slip" (game night at Alex's). The fix is on the card: pack the pills, or pick "home by 11".
  A slip is rolled once from a fixed roll per seed, week and day (like `bodyRoll`), shown honestly.
- **Dice belong to the card.** Each card's exposure roll comes from seed, week and card, not slot, so
  moving a card never changes its luck.
- **Optional (cut first): week 2 is a different week.** Its hand swaps yard work for **Farm day with
  the youth group** (4 points, 2 energy, 40% mold) and **The orchard, not the hayloft** (3, 10%).

**Score.** `version: 4`. New `goal: 40`. `perDodgedPercent` 1 to **0.5** (rounded per card: Indoor
jobs 18, beach 15). `perDose: 30` stays but counts **doses the plan keeps safe**: each day counts 1
minus its slip chance (1 for routine, 0.5 for a late night, 0 for pills at home), labelled
"Routine kept". So Choices stays luck-free (it reads the plan's odds, like Odds pushed), and a slip
that does happen costs Outcome through the battle, which is where luck already lives. `checked`,
`perPoint` and all Outcome weights unchanged.

**Worked example (week 1, 5 energy).** Hand: Yard work with Maya / Indoor jobs, the lake / the beach,
band, the sleepover, game night / home by 11. Goal 12.

| Slot  | Day 1                     | Day 2         | Day 3          |
| ----- | ------------------------- | ------------- | -------------- |
| Day   | Indoor jobs (-2, 3 pts)   | rest (+1)     | rest (+1)      |
| Night | Sleepover, packed (-2, 3) | Beach (-2, 4) | Home by 11 (-1, 2) |

Energy 5, 3, 1, 2, 0, 1, 0. Points 12, goal met. Choices 120 living + 33 odds + 90 routine + 40 goal
= **283**, with a 35% chance something lands. Nearby plans the player will weigh:

- The lagoon instead of the beach: 13 points, Choices 278, 57% chance of an exposure (strep and
  staph). Tempting: 5 behind on Choices, the dice decide the rest.
- Drop the sleepover, keep band and game night at Alex's (late): 12 points, Choices 268, and day 3's
  dose has a 50% chance to slip.
- Drop the sleepover and play it safe with home by 11: 11 points, goal missed, Choices 233. The 12th
  point is worth 50.

Enumerated: 146 legal plans, 42 meet the goal (29%), 19 within 10% of the best, and the unpacked
sleepover is never in the top plan (protecting routine stays the luck-free best, and is a cost, not
a free tick).

**What changes.**

- `src/sim/params.ts`: cards `game`, `gameEarly` (and `farm`, `orchard`); `life.hands` per week;
  `life.meds.slip: { lateNight: 0.5 }`; `life.diceSalt`; `score` as above.
- `src/sim/life/types.ts`: new card ids; dose cause `"slipped"`; `planned` becomes debug-only.
- `src/sim/life/cards.ts`: text for the new cards, a `lateNight` flag, `handFor(week)` replacing
  `HAND`.
- `src/sim/life/calendar.ts`: `createLife` deals `handFor(week)`; game night is evening-only; at day
  end a late-night day rolls its slip; `medForecast` reports the chance; exposure rolls keyed by
  card. `setDose` stays for the debug panel and tests, not the player UI.
- `src/sim/life/preview.ts`: the card preview carries the dose risk ("50% the pills slip").
- `src/sim/score.ts`: goal bonus, expected doses, `cardChoices` includes the routine effect.
- `src/sim/life/bots.ts`, `src/sim/campaignBots.ts`: 5-card layouts with a drop order, `planner`
  and `forgetful` bots (section 5).
- `src/app/lifeModel.ts` (`doseStrip`, beats: "Game night ran late; the evening pills slipped."),
  `src/app/lifeScreen.ts` (no `onSetDose`), `src/ui/lifePanel.ts` (read-only chips with a glyph,
  word and %, tap scrolls to the causing card), `src/ui/cardStyle.ts` and
  `src/app/campaignModel.ts` (icon and colour for the new cards).
- Tests: `life.test.ts` (dose toggle block, hand size), `lifeModel.test.ts`, `campaign.test.ts`,
  `life/balance.test.ts`, `campaign.balance.test.ts`, `score.balance.test.ts`,
  `battleDepth.balance.test.ts` (skipMeds bot).

**Slices (about 12 hours).** A1 no toggle, chips as forecast, card-keyed dice (2h). A2 game night
card and the slip roll, icon and colour (3h). A3 score v4 and card faces (2h). A4 bots and balance
retune (3h). A5 week-2 farm hand (2h).

**Risks.** A fifth card makes "not enough energy" common; the hint text must say which card to drop
for the plan to fit, not just refuse. A 50% slip is a dice moment on the medication, which could feel
unfair; it is shown before the plan is committed and "home by 11" removes it. Score ranges move and
best scores reset.

**Clinical story.** Strong and simple: doses are missed when the routine breaks (a night away, a
late night), and planning around it protects them. No claim about how much one missed dose matters
in reality; the battle effect is already a declared game rule.

**Phone.** The hand grows by one card (about 60px more in the scrolling panel). The dose strip stays
three 44px cells, now status, not buttons: a check, "!" or cross glyph, a word and the %.

### Option B: Life happens (a seeded event each week)

**Rules in plain language.**

- Keep the four-card hand and add **one life event per week**, drawn from a small deck by seed and
  shown on the calendar at week start, so it shapes the plan: **Rain on day 2** (outdoor cards
  there lose 2 points), **Exam review** (day 3 evening is taken), **Family trip** (an overnight on
  day 1: the next morning's dose is at home unless packed), **Stomach bug** (day 2: -1 energy, and
  the dose has a 50% slip unless that day's daytime slot is a rest, "take it with food"), **Night
  shift** (no one home to remind you on day 3: 30% slip unless the evening is a rest).
- Missed doses come from these events and the sleepover. There is no toggle.
- Post-beta extension: a **side-effect morning** ("the new pills upset your stomach") with three
  answers: push through (-1 energy), skip today, or call your care team (takes a slot, fixes it for
  the arc). This is the one place a deliberate skip appears, with a real reason and a smarter third
  option.

**Worked example.** Week 1, Stomach bug on day 2. The smarter plan put the beach on day 2 evening
and band on day 3. Now day 2 needs a daytime rest to keep the dose safe, energy drops by 1, and the
beach no longer fits alongside the sleepover's pills. The player moves the beach to day 3 and drops
band: 10 points, goal missed but the routine kept; or keeps band, takes the 50% slip on day 2.

**What changes.** `params.ts` (event deck), `life/types.ts` (`LifeState.event`), a new
`life/events.ts` (draw, rules, forecast), `calendar.ts` (blocked slots, point changes, slips),
`score.ts` (expected doses as in A), `lifeModel.ts` and `lifePanel.ts` (event banner and calendar
marks), bots (react to events), every life test that assumes an empty calendar.

**Slices (about 18 hours).** Events sim (6h), UI marks and copy (5h), score and bots (4h), retune
and tests (3h).

**Risks.** Five rule exceptions to learn in a two-week arc; more text on a phone; across seeds,
Choices depends on which event came (fine for best-per-seed, odd across seeds). Session time
grows. It adds variety but the energy budget still fits the hand in most weeks, so the week is
harder to read without being much harder to plan.

**Score.** As A for doses; no goal bonus needed if the events make the goal miss sometimes. Version
4.

**Clinical story.** Rich: illness, travel and a household routine are real causes of missed doses,
and "take it with food" and "call your care team" are good habits. Wording needs a clinician check
(stomach upset advice differs by drug).

**Phone.** One banner line plus a mark on one calendar cell; the side-effect choice is a small
three-button card.

### Option C: Season goals (an arc-long plan)

**Rules in plain language.**

- Replace the weekly 12-point meter with **three named goals for the arc**, shown at the start:
  **Band recording** (band in both weeks, +40), **Jordan's summer** (a day at the water in both
  weeks, +40), **Maya's party** (help with the yard in week 1, +30). Life points still pay
  `perPoint`.
- Energy is tightened so that both weeks cannot carry every goal: `weekRecovery` 4 to 3, so a
  contained battle (2) starts week 2 at 5 and a backup (1) at 4.
- Doses as in Option A (routine, disruptions with odds, no toggle), with the sleepover as the only
  disruptor if the game night card is not added.

**Worked example.** Week 1: Indoor jobs, beach, band, sleepover packed: all three goals on track.
The battle ends contained, so week 2 starts at 5 energy and a fever brings the doctor. Beach, band
and the early doctor fit; the sleepover does not. The player keeps both "both weeks" goals and
gives up the sleepover's points.

**What changes.** `params.ts` (goals, recovery), a new `life/goals.ts`, `campaign.ts` (goal state
across weeks), `score.ts` (goal bonuses), `lifePanel.ts` (a goals card in place of the points meter),
`interludeScreen.ts` (goals on the arc-complete screen), bots and balance tests.

**Slices (about 14 hours).** Goals sim and campaign state (5h), UI (5h), score, bots, retune (4h).

**Risks.** Battle luck now leaks into week-2 Choices through energy (a bad fight shrinks the next
plan), which bends the "Choices is luck-free" promise. Goals are only interesting with more weeks;
with two, there is little to plan. Most cost of the three for the least week-1 change.

**Score.** Goal bonuses replace the single goal; `perDose` as A; version 4.

**Clinical story.** Neutral; it is about living fully, which is the pitch's message.

**Phone.** A three-line goals card replaces the points meter cell; fits.

### Comparison

|                                  | A: Tight week                | B: Life happens          | C: Season goals         |
| -------------------------------- | ---------------------------- | ------------------------ | ----------------------- |
| Real decisions per week          | Drop a friend, versions, goal threshold, pills | Replan around the event  | Spread goals over weeks |
| Goal met automatically?          | No (29% of plans)            | Sometimes                | No                      |
| Missed doses from                | Plan disruptions, with odds  | Events and plan          | As A                    |
| Deliberate skip                  | Gone                         | Gone (side-effect event post-beta) | Gone         |
| Choices stays luck-free          | Yes                          | Per seed only            | No (energy carry)       |
| Week 1 vs week 2 differ          | With slice A5                | Yes                      | Yes                     |
| Cost                             | About 12h (floor 7h)         | About 18h                | About 14h               |
| Phone                            | +1 card                      | +1 banner                | Goals card              |

## 4. Recommendation

**Build Option A.** It fixes both felt problems at the root: the week becomes a small resource puzzle
with several good answers (more invitations than energy, a goal that pays, risky versions that are a
close call), and missed doses come from life, not from a tap. It is mostly data, one card and one
roll, and it keeps every promise of the score. Option B's side-effect morning and event deck, and
Option C's season goals, go to the post-beta backlog (they fit longer arcs and the holiday arc's
"skipped-dose event" in `pitch-4.md:35`).

**Smallest version that fixes the felt problems (about 7 hours, three slices, in order):**

1. **No toggle; doses by routine (2h).** Remove the day-chip buttons and `onSetDose`; chips show the
   forecast with a glyph, a word and the %; beats use no-blame copy. Keep `setDose` for the debug
   panel ("force a missed dose" for the NIH demo) and tests. Exposure dice keyed by card. Done when:
   no player action can skip a dose, and moving a card on the same seed never changes its roll.
2. **Game night at Alex's (3h).** The fifth card, its smarter version, the late-night slip roll,
   icon and colour, the "which card to drop" hint when energy runs out. Done when: the full hand no
   longer fits at 5 or 6 energy, and the day chip shows "late night: 50%".
3. **Score v4 (2h).** Goal +40, odds pushed 0.5 per percent, Routine kept (expected doses x 30),
   card faces updated. Done when: the enumeration test (section 5) passes.

Then slice A4 (bots and balance, 3h) is required to keep `mise run check` green; budget it with the
three slices (10h total). Slice A5 (the farm week) is extra.

**Schedule.** Do it now, before B1 (mobile), because the hand grows to five cards and B1 has to fit
it. Pay for it from the B10 buffer and the existing cut list (the epilogue B6 is already first).

**Cut line, in order, if the schedule slips:**

1. A5, the different week-2 hand (week 2 still differs through energy, reservoirs and the doctor).
2. Card-keyed dice (the hidden slot lever stays; replays are still deterministic).
3. The "which card to drop" hint text (keep the plain "not enough energy").
4. Halving odds pushed (keep 1 per percent; smarter stays a little more dominant).

**Never cut:** removing the toggle (it is the owner's direct complaint) and the fifth card plus the
goal bonus (together they are what makes the week a choice).

**Verify with the patient tester (B9 session, session log and probe):**

1. **A real choice:** while planning week 1, ask them to think aloud. Target: they name a friend
   they are dropping and why, at least once per week. Log replans (card moved or removed) per week:
   target at least one.
2. **Not trivial on first play:** target the goal missed or the Choices best not reached on the
   first week 1, and a higher Choices on the replay of the same seed.
3. **Doses:** after a slip or a "pills at home", ask "why did that dose get missed?" and "did that
   feel like your fault?" Target: they name the game night or the sleepover, and say it felt fair,
   not blamed.
4. **Realism:** ask what actually made them miss doses as a teen. Use the answers for post-beta
   disruptor cards (and send them to the clinician list).
5. **Temptation:** ask whether the lagoon or game night at Alex's ever felt worth it. Target: yes at
   least once (risky stays tempting).
6. **Replay:** at the arc-complete screen, do they choose "Play again (same seed)" unprompted?
7. **Time:** a week planned in under two minutes after the first one.

## 5. Bot and balance plan

**Bots** (`src/sim/life/bots.ts`, `src/sim/campaignBots.ts`). Each places cards in a drop order and
skips any that would not fit (the campaign bots already do this, `campaignBots.ts:91-101`).

- `home`: rests every slot (unchanged).
- `careless` (test file only): risky versions, pills unpacked, game night at Alex's, never the
  doctor.
- `risky`: risky versions, pills packed, game night at Alex's, doctor late.
- `mixed`: coin flips per version, for the pills and for the drop order; any doctor policy.
- `forgetful` (replaces `skipMeds`): smarter versions, but pills unpacked and game night at Alex's:
  the player whose routine breaks.
- `smarter`: smarter versions in a fixed order (beach, indoor jobs, sleepover packed, home by 11,
  band), early doctor: the naive careful player.
- `planner` (new): each week enumerates the legal plans (about 150; the throwaway script does it in
  milliseconds) and takes the best planned Choices, early doctor: the reference best.
- `skipAll` (test file only, via `setDose`): every dose skipped, kept so
  `battleDepth.balance.test.ts` can still check "doses reach the battle" on matched seeds.

**Targets** (two-week campaigns, thoughtful battle play):

| Measure                      | home    | careless | risky   | mixed   | forgetful | smarter | planner |
| ---------------------------- | ------- | -------- | ------- | ------- | --------- | ------- | ------- |
| Goal met per week            | 0%      | 85-100%  | 85-100% | 40-80%  | 60-95%    | 50-90%  | 95-100% |
| Doses missed per week (mean) | 0       | 1.2-1.6  | 0.3-0.6 | 0.2-0.6 | 1.2-1.6   | 0-0.1   | 0-0.3   |
| Weeks with an exposure       | 0%      | 65-80%   | 60-75%  | 45-60%  | 30-40%    | 30-40%  | 30-45%  |
| Choices per campaign         | 180-200 | 420-500  | 520-560 | 470-540 | 490-530   | 520-560 | 555-580 |
| Total per campaign           | 380-400 | 500-600  | 680-730 | 640-720 | 640-710   | 710-760 | 740-790 |
| Full battles cleared         | n/a     | 5-30%    | 50-75%  | 45-75%  | 50-80%    | 85-100% | 85-100% |
| Full battles needing backup  | n/a     | 30-70%   | 0-8%    | 0-12%   | 3-12%     | 0-3%    | 0-3%    |

Battle-only targets stay as in `battle-depth-design.md` section 5 (the battle rules do not change).

**Relations (each an assertion):**

1. Order: planner > smarter > mixed > careless > home on total, and planner > risky by at least 40
   per campaign. Careless above home (today it is 14 below).
2. Planner is best on Choices; risky's Choices is within 40 of the planner's (temptation is real).
3. Goal is a choice: in a fresh week at 5 energy, 20-40% of legal plans meet the goal (designed:
   29%), and at least 10 plans are within 10% of the best Choices (designed: 19).
4. Routine is the luck-free best: no top-Choices plan at 5 or 6 energy leaves the pills unpacked.
5. Doses still reach the battle: on matched seeds `forgetful` loses at least 1.5 tissue more per
   full battle than `smarter`, and `skipAll` at least 2.5 (today's skipMeds measures 3.0).
6. Dice: for a fixed seed, every card's exposure roll is the same whichever slot it sits in.
7. Bounds: each week's parts stay non-negative; Choices per week at most 283 + 20; total per campaign
   at most 810.
8. Determinism: the same bot and seed score the same twice (unchanged).

**Knobs, in the order to try:** game night's slip chance (0.4-0.6), the goal bonus (30-50),
`perDodgedPercent` (0.4-0.7), game night's points (2-3), `goalTarget` (12-13). Leave `weekRecovery`
and `startEnergy` alone: lowering them leaks battle luck into Choices.

**Best scores and `perDose`.** Bump `PARAMS.score.version` to 4 in slice 3 (the key already carries
the version, `b1a-design.md` 1.5, so old bests are simply not shown; no migration). Keep `perDose`
at 30 but redefine it as Routine kept (doses the plan keeps safe). Lowering it to 15 as
`battle-depth-design.md` question 6 suggested would make "leave the pills, play one more card" the
top plan, which teaches the wrong habit; with the toggle gone there is no deliberate skip left to
over-reward.

## 6. Open questions for Tracy

1. Build Option A (the tight week), with Options B and C in the post-beta backlog? **Suggested:
   yes.**
2. Remove the per-day dose toggle from the player screens entirely, and keep a "force a missed dose"
   control in the debug panel for demos and tests? **Suggested: yes.**
3. Missed doses come only from disrupted routine, shown on the day chip before you commit: an
   unpacked sleepover leaves the pills at home (missed, as today), a late game night gives a 50%
   chance the pills slip? **Suggested: yes.**
4. Add a fifth invitation, "Game night at Alex's" (smarter version "home by 11"), so every week has
   more friends asking than energy allows? **Suggested: yes.**
5. Meeting the life-points goal adds +40 to Choices? **Suggested: yes.**
6. Halve "Odds pushed" (0.5 per percent, rounded per card) so the lagoon and the mulch are a close
   call on Choices rather than a clear loss? **Suggested: yes.**
7. Keep `perDose` at 30 but count doses your plan keeps safe ("Routine kept"), so Choices stays
   luck-free and protecting your routine stays the best play? **Suggested: yes.**
8. Bump the score version to 4 (old best scores stop showing, no notice needed)? **Suggested: yes.**
9. Tie each card's exposure dice to the card, not the calendar slot, so moving a card on a replay
   never changes its luck? **Suggested: yes.**
10. Week 2 swaps yard work for a farm day (the hayloft, or the orchard instead), as the first thing
    to cut? **Suggested: yes.**
11. Build this now, before B1 (mobile), about 10 hours from the B10 buffer and the cut list?
    **Suggested: yes.**
12. Is it acceptable that a plan can knowingly risk a dose (game night at Alex's) for a bit more
    fun, given the miss is a chance, not a choice, and the score still favours protecting the
    routine? **Suggested: yes**; it is the honest teen trade-off, and the battle shows the result.
13. Add to `clinician-questions.md`: item 22 (priority B) "What do your teen patients say makes them
    miss prophylaxis doses, and is showing misses as a chance from disrupted routines (nights away,
    late nights) a fair picture?"; item 23 (priority B) "Is hay or a barn loft a fair Aspergillus
    exposure for a farm card, with the orchard as the smarter option?" **Suggested: yes.**
14. During the patient session, ask the tester what actually made them miss doses as a teen, to
    choose the next disruptor cards? **Suggested: yes.**
