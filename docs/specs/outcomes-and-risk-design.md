# Outcomes, luck and the exposure meter: design

What the player is told at the end of each play cycle, how luck and choices are kept apart on screen,
and a new status cell that shows the week's odds. Design only. Slices are tracked in
`../plans/beta-plan.md`. Items marked **(my call)** are defaults; Tracy decides them in section 7. The
clinical corrections in `fodder.md` win over anything here.

## 0. The owner's brief, restated

- Every play cycle ends in one clear result: a win, a setback, or a better score than before.
- Choices do not decide outcomes. They move a **probability**. Sometimes you are lucky; sometimes you
  do everything right and it is still a hard fight. The game must show both without a lecture.
- A prominent meter could make the link between plan and odds clearer.
- Arc 1 Part A is not "losing", and it is not a non-event: the body is sick and the cells cannot
  finish the infection.

## 1. What the code does today (checked)

- **Odds per card** are fixed game rules (`PARAMS.life.cards.*.chance`: yard 45%, lake 45%, beach
  15%, indoor jobs 10%, sleepover 10%, band and both game nights 5%), rolled once per card from
  `cardRoll(seed, week, card)`. Medication never changes them.
- **Battle kind** (`battleKindOf`, `calendar.ts`): full if anything landed, a carried reservoir
  flared, or the doctor found one; otherwise a skirmish. There is always a fight (except a viral
  doctor visit with nothing landed, a "quiet" week).
- **The week preview** (`exposurePreview`, `preview.ts`) already computes `chanceAnyExposure`
  (1 minus the product of the pending cards' misses) and `chanceBattle` (the same, or 1 once
  something is certain). Unflared reservoirs are left out on purpose.
- **Where the odds show:** a "Full battle odds: 45%" line under the calendar
  (`lifeScreen.ts:362-366`). On a phone it is **hidden while the calendar is pinned**
  (`lifePanel.ts:512`, `m.odds && !pinned`), which is exactly when the player is placing a card.
- **Medication affects the fight, not the odds:** aura stall, charges, arrival size, the carried
  roll. So in the sim "risk" has two parts: will something come home (the plan), and how ready the
  body is (the routine). The Medication cell already shows the second.
- **Results today:** full battle "All clear" / "Contained" / "Backup arrived"; skirmish "All quiet" /
  "Still stirring"; week-end card "The week in review"; summary "Your 2 weeks: N" with Choices and
  Outcome per week and a best line per seed (`bestScores.ts`, key `version|arc|variant|seed`).
- **Arc 1:** Part A is 3 turns, medication 0, residual kill chance 0, tissue ends 12 to 19.
  `partAStoryCard` has two unused slots, `outcome` and `score`. The tissue state word is "healthy" at
  16 or more (`tissueState`, `battleModel.ts`), so a well-played Part A reads "healthy".

## 2. The outcome model

### 2.1 Two questions every cycle answers, never mixed

1. **How you lived** (your call, no dice): the life-points goal, Choices.
2. **How it went** (dice included): what came home, the fight, Outcome.

A cycle's headline is always one of these, said as a fact. The game never says "you lost", "failed",
"defeat" or "your fault". It does say plainly when something did not work out.

### 2.2 Is there a real "lose"? Yes, per cycle; no, per game

There is no game over (decided). But a cycle can end in a **setback**, and it must be visible:

| Cycle | Win | Middle | Setback (the "lose") | Cost carried | Never blamed on the player |
| --- | --- | --- | --- | --- | --- |
| Planning a week | Goal on track (13) | | Short of the goal | none yet | that a card does not fit after a hard fight (energy) |
| Skirmish | All quiet | | Still stirring | aftermath, -1 energy next week | it is the body's patrol, it comes every week |
| Full battle | All clear | Contained | Backup arrived | low Outcome, 1 energy, low tissue | that something came home at all |
| The week | Goal met and all clear | one of the two | goal missed and backup | as above | the dice: a luck line says which way they fell |
| The summer (Arc 2) | Both goals met; a new best | one goal | no goals met | none (end) | Outcome; the best to beat is on the same dice |
| Arc 1 Part A | (none possible) | | **Not finished** | none | all of it: the tool was missing, and no one knew yet |
| Arc 1 Part B | All clear | Contained | Backup arrived (rare) | none | |

**How a setback feels:** short, warm, factual, with the cost and the way back in the same card.
"Backup arrived. Your care team stepped in, which is exactly what backup is for." (exists) plus the
luck line (2.3) plus "Play again (same seed)" at the end of the arc. Real stakes are the score, the
energy for next week and what carries over; the way back is the replay on the same dice.

**Win and improve.** The week's win is the goal (Choices, the player's) and the clean fight. The
summer's win is "both goals met" (living fully, `pitch-4.md`: an arc ends when its goals are scored)
and the score's improvement is the best on this seed, which is already stored.

### 2.3 Luck, said once, in one line

After every week the game compares **the week's odds** with **what happened** and prints one line.
No advice, no "should". Bands from the same rounded odds as the meter (section 3):

| Week's odds | Something came home | Nothing came home |
| --- | --- | --- |
| low or some (under 50%) | "Your plan kept the odds at 35%. Something came home anyway. That happens." | "Your plan kept the odds at 35%, and nothing came home." |
| likely (50% or more) | "A big week: 70% odds, and something came home." | "A big week: 70% odds, and nothing came home. Lucky one." |
| none (0%) | (cannot happen) | "A quiet week at home. Nothing came home." |

Extra causes, when they apply: "Nothing new came home, but something left over flared up." and "The
doctor found something left over, so you fought it on your terms."

**"You did it right and it was still hard":** on a full battle's outcome card, when the grade is
Contained or Backup arrived **and** the week was careful (odds under 50% and routine 3 of 3), add:
"Your plan and your routine were strong. Some fights are just hard." There is no matching line for a
careless week. The odds already said it; repeating it would be the lecture.

## 3. The exposure meter

### 3.1 What it measures (honest to the sim)

**Recommended: "Exposure", the chance that something from this week's plan comes home with you.**
It is `1 - product(1 - chance)` over every card in the plan, played or still pending (the played
ones from `life.rolls[].chance`, the pending ones from `exposurePreview().pending`). It is the
number on the cards, combined, and it is the chance of a full battle from the plan.

What it deliberately leaves out, and how that is still honest:

- **Medication.** It does not change the odds in the sim, so it is not in the number. The
  Medication cell sits next to it: odds and readiness side by side.
- **Leftovers.** A carried reservoir can flare. The player was told about it on last week's card,
  so the cell's explain line says so in words ("Something left over from last week may also flare
  up; the doctor can find it"), and its value gets a "+ leftover" tag. No percentage: the flare
  chance depends on days and the doctor, and a number would be false precision.
- **The doctor.** Booking the doctor never moves the meter. With a leftover, a visit makes a full
  battle certain (on your terms, with a strong charge); a "battle chance" meter would rise on the
  right choice and teach the wrong thing. This is the main reason not to show `chanceBattle`.

Rejected: expected germs or expected tissue loss (needs the battle sim, false precision), and "any
fight" (always 100%, the skirmish).

### 3.2 Wording

- Label **Exposure** (the word the cards already use: "45% chance of exposure to Aspergillus").
  No fear words (danger, threat, risk of infection).
- Value: the percentage **rounded to 5** ("35%"), "under 5%" for any non-zero chance below 5, "0%"
  only with no card that can land.
- State word: **none** (0), **low** (under 20%), **some** (20 to 49%), **likely** (50% and up).
  A careful four-card week is about 30-35%, "some": even a careful week has a chance, which is the
  honest message. Colour band plus the word, never colour alone.
- During and after the week the value keeps the plan's odds and the state word reports what
  happened: **so far clear**, **came home**, then at the end **stayed away** or **came home**.
- Explain (tap): "The chance something from this week's plan comes home with you: 35%. These are game
  odds. Your medicine does not change them; it helps your cells in the fight."

### 3.3 Where it lives

- **Life screen strip: yes.** Points, Energy, Medication, Exposure, Score. It replaces the
  "Full battle odds" line under the calendar, so the odds are visible on a phone while pinned.
- **Battle screen: no.** In battle the stake is Tissue with its backup notch, which already works
  as the danger meter of the fight. The odds were the week's; the battle starts after the dice.
- **Arc 1: no** (no life phase).

```
Laptop, life screen, planning
+--------+--------+-----------+-------------+--------+
| Points | Energy | Medication| Exposure    | Score  |
| 9/13   | 3/6    | 3/3       | 35%  some   | 210    |
| ====-- | ###... | ###       | =======.... |        |
+--------+--------+-----------+-------------+--------+

Phone portrait (390 wide): five cells, short labels under 420px
+------+------+------+---------+-----+
|Points|Energy| Meds |Exposure |Score|
| 9/13 | 3/6  | 3/3  |35% some | 210 |
| ==-- | ###. | ###  | ===.... |     |
+------+------+------+---------+-----+
(tap Exposure)  The chance something from this week's plan comes home
                with you: 35%. These are game odds...
```

The strip gets an optional `short` label per cell ("Meds" for Medication) used under a 420px media
query, and a `data-cols="5"` grid rule. Below 340px it already drops to two columns.

### 3.4 How it moves while planning

- Placing or removing a card recomputes it at once.
- **Before/after while choosing.** With an activity picked and no slot yet, the bar shows a ghost
  part up to the odds with that card added, and the existing hint line reads "Now tap a time slot
  for The lake. Exposure 35% to 65%." Swapping a version shows the same pair. This is the cheapest
  way to make "this card moves the odds" felt.
- Points and Exposure sit side by side: more living raises both. A week at home reads "0% none"
  next to "0/13 building". That is the core trade-off on one line.

### 3.5 After the week

The week-end panel ("The week in review") and the outcome card both print the luck line (2.3). The
cell shows "35% stayed away" or "35% came home" until the next week starts. This is the meter
becoming an outcome.

### 3.6 Alternatives

| Option | What | Cost | Verdict |
| --- | --- | --- | --- |
| A. Exposure cell (above) | strip cell, ghost preview, result state, luck line | about 6h | **recommended** |
| B. Fix the odds line only | keep "Full battle odds" under the calendar, show it while pinned, add the before/after to the hint | about 2h | fallback if time runs out; not prominent, and it rises with the doctor |
| C. Odds on every calendar cell | each slot shows its card's % and the row a total | about 4h | clutters a 56px phone slot |
| D. Danger including medicine | one number for "how bad could it get" | 8h+ | not honest without the battle sim; mixes the two questions |

## 4. Score and summary screens

### 4.1 No change to the score model

Choices (luck-free) and Outcome (dice) already separate the two questions. Keep every weight, keep
the week goal at 13, **no score version bump**, so best scores stay valid. Nothing in this design
reads or writes a score. The meter and the luck line are display only.

### 4.2 The week's outcome card: a "This week" block

It replaces the single score line (`weekScoreLine`) under the existing grade card.

```
+----------------------------------------------+
| Backup arrived.                              |
| Your care team stepped in, which is exactly  |
| what backup is for. You did your part.       |
| Your plan and your routine were strong.      |
| Some fights are just hard.                   |
| ...carrying forward (unchanged)...           |
| This week                                    |
|  Lived    13 of 13 points, goal met          |
|  Odds     35%: something came home anyway    |
|  Fight    backup arrived, tissue 10 of 20    |
|  Score    251 = Choices 221 + Outcome 30     |
| [ Next week ]                                |
+----------------------------------------------+
```

### 4.3 The summer summary

Headline first, then the existing per-week cards with one "Odds" row each.

```
Your summer: 712                 New best on this summer!
Goals met: 2 of 2. You lived it fully.
Week 1: 381  Odds 35%, nothing came home. All clear.
            Choices 283: living 130, odds pushed 33, ...
            Outcome 98: tissue 40, fight 40, clear 20
Week 2: 331  Odds 70%, something came home. Contained.
...
Infections happen whatever you do. Choices is what you chose ...
[ Play again (same seed) ]  [ ... ]
```

"Goals met: 1 of 2" reads "One goal met." and "0 of 2" reads "A quieter summer." No judgement either
way; the replay on the same seed is the chance to do better.

### 4.4 Conflicts with the plan and earlier decisions

- **B1b "Full battle odds: 45%"** is replaced by the Exposure cell (different label and number:
  the plan's odds, not the battle chance). Flag for Tracy (question 2).
- **`arc1-tutorial-design.md` 3.1 and the B4 done line** say "Part A shows no grade and no tissue
  score". This design keeps "no score" but adds a result word and readings. The done line becomes
  "Part A shows a result (Not finished), no score".
- **Owner decision (Arc 1, Q4): "tissue and inflammation readings visibly strained".** As built, a
  good Part A ends at 17-19 tissue, which `tissueState` calls "healthy". See 5.1 for the fix.
- **Week goal 13, score v4, best keys:** untouched.
- **"Held" vs "Contained":** the tutorial design uses "Held" for Part B, the campaign uses
  "Contained". One word should win (question 7).

## 5. Arc 1

### 5.1 Part A: the result is "Not finished"

No score and no grade letter: a fight built so the cells cannot finish gives a score nothing to
measure but the build, and replaying it "to do better" would be a trap. But it has a **result**, the
same shape as every other fight, so the player learns the frame and Part B can be compared to it.

- **Result word: "Not finished".** True, plain, not a lose said about the player.
- **Readings:** what was finished, what was not and where, tissue as a number with its honest word,
  and **Medication: none**.
- **"Still sick" is carried by an Infection reading,** not by bending the tissue word: "Infection:
  not finished. Your body is still sick." The tissue reading stays truthful (it can say 18 of 20).
  This satisfies "the body is sick" without retuning T1.

The story card's `outcome` slot takes the result block; the `score` slot stays empty (keep it for a
possible later use, or delete it in T3).

```
+--------------------------------------------------+
| The day it got a name                            |
|                                                  |
| Not finished                                     |
|   Streptococcus   finished                       |
|   Aspergillus     still there, inside your cells |
|   Infection       not finished, still sick       |
|   Tissue          15 of 20                       |
|   Medication      none                           |
|                                                  |
| Your cells did everything they could. ...        |
| ... The missing tool had a name: CGD.            |
| And with a name came a plan.                     |
| [ See what changes ]                             |
+--------------------------------------------------+
```

Battle strip in Part A: the Medication cell reads value **"none"**, no segments, state word hidden,
explain "No one knew about CGD yet, so there was no daily medicine." (owner decision).

### 5.2 Part B: the contrast in the result itself

The normal outcome card (no energy, carry or turns-played lines), the arc copy, and a **before and
now** block from Part A's readings (kept in memory by the runner; nothing stored).

```
+--------------------------------------------------+
| All clear                                        |
| Same germs, different ending. CGD takes one tool |
| away, not your whole defence, and your medicine  |
| helps fill the gap.                              |
|                  Before          Now             |
|   Result         not finished    all clear       |
|   Aspergillus    still there     finished        |
|   Tissue         15 of 20        19 of 20        |
|   Medication     none            3 of 3, full    |
| [ Finish ]                                       |
+--------------------------------------------------+
```

- If Part A was skipped: no table, one line "Before the diagnosis, this germ was not finished."
- If Part B ends Contained or Backup arrived, the table still shows; the copy is the kinder
  "Not quite all clear, and that is fine..." from the tutorial design.
- The tissue row is shown even if Part B's tissue is lower (rare, honest); the result row carries it.

## 6. Slices

| Slice | Hours | What a reviewer sees | Needed by T3? |
| --- | --- | --- | --- |
| O1 Part A result and Part B compare | 3 | Part A story card with the "Not finished" block and Medication: none on the strip; Part B card with the before/now table; skip shows the one-liner. Pure model functions with tests (`partAReadings`, `compareRows`). | **Yes, decide first; build inside T3** |
| O2 Exposure cell | 3 | A fifth life-strip cell (value, word, bar, explain), short labels on phone, the calendar odds line gone; screenshots at 390x844 and 1280x800. `weekOdds(life)` pure and tested (rounding, "under 5%", "+ leftover"). | no |
| O3 Before/after preview | 1.5 | Picking a card ghosts the bar and the hint reads "Exposure 35% to 65%". | no |
| O4 Luck line and week block | 3 | `luckLine(odds, landed, causes)` pure and tested over the 2.3 table; shown in "The week in review" and the outcome card's "This week" block; the "still hard" line on careful weeks. | no |
| O5 Summer summary | 1.5 | Goals-met headline and an Odds row per week. | no |
| **Total** | **12** | | |

Floor that answers the owner: O1, O2, O4 (about 9h). Cut first: O5, then O3. If O2 slips, option B
(2h) keeps the odds visible on a phone.

## 7. Open questions for Tracy

1. **Setbacks per cycle, no game over:** Backup arrived (battle), Still stirring (skirmish), goal
   missed (week), Not finished (Part A); never "lost" or "failed". Default: yes.
2. **Exposure cell** on the life strip (plan odds rounded to 5, words none/low/some/likely),
   replacing "Full battle odds"? Default: yes.
3. **Not on the battle screen;** Tissue and its notch are the fight's meter. Default: yes.
4. **Leftovers as words ("+ leftover"), not in the %,** and the doctor never moves the meter?
   Default: yes.
5. **The luck line** after every week, and "Some fights are just hard" only on careful weeks, with
   no line for careless ones? Default: yes.
6. **Part A: result "Not finished" with readings, no score;** "still sick" via an Infection reading
   rather than retuning tissue? Default: yes.
7. **One word for the middle grade:** "Contained" everywhere (Arc 1 Part B too)? Default: yes,
   "Contained" (it is already on the campaign and summary screens).
8. **No score change and no version bump.** Default: yes.
9. **Summer headline "Goals met: 2 of 2"** as the summer's win next to score and best. Default: yes.
10. **"This week" block** on the outcome card replacing the single score line. Default: yes.
11. **Short labels on phones** ("Meds"). Default: yes.

## 8. Clinician questions to add (`clinician-questions.md`)

Numbering continues after 26 (note: `week-phase-design.md` proposed 22 and a farm 23 that were never
added; 23 is now an Arc 1 item).

| # | Question | Working assumption | Priority |
| - | -------- | ------------------ | -------- |
| 27 | The game shows exposure chances as percentages per activity (for example 45% for yard work with mulch, 10% for indoor jobs). They are game numbers. Is it acceptable to show them, labelled "game odds", or could a patient read them as real risk figures? | Acceptable with "These are game odds" in the explain line; the relative order (mulch and brackish water far above indoor chores and a beach) is what matters | A |
| 28 | The game's message is that choices change the chance of an infection, not the outcome: "Some fights are just hard", and a careful week can still bring a germ home. Is that the right message for teens, and does it risk making precautions feel pointless? | Right message, because the score still rewards lowering the odds and the odds visibly move | A |
| 29 | In the game, daily prophylaxis does not change whether a germ arrives; it makes the fight easier (germs slowed, smaller arrivals, charges). Is that an acceptable game picture, given that real prophylaxis lowers the chance an exposure becomes an infection? | Acceptable as a declared game rule (related to 21 and 26) | B |
| 30 | Before diagnosis the tutorial ends with "Infection: not finished. Your body is still sick." Is "still sick" fair and not frightening wording for that moment? | Fair; the card goes straight on to "the doctors helped your body clear it" | B |
