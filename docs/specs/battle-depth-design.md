# Battle depth: design pass

Design-only pass requested in `../plans/beta-plan.md` (B1b, "a battle-depth design pass follows
before B1"). No code was changed. Numbers come from `src/sim/params.ts` on `feat/beta` at `096ce1f`
and from a throwaway survey (300 seeds, two-week campaigns, every battle played by `thoughtfulPlay`
in `src/sim/campaignBots.ts:76`, plus the `hold` and `engulfAll` bots from
`src/sim/battle/bots.ts` replayed on the same week-1 battles). Clinical corrections in `fodder.md`
win over everything here: neutrophil count is never a lever, no interferon-gamma, viruses are
background only, curative therapies are not gameplay, there is always a battle, no game over.

## 1. Diagnosis

### 1.1 What was measured

Battles per bot over 300 two-week campaigns (thoughtful play):

| Bot      | Kind     | Battles | Mean turns | Turns played (count)            | Ended before the clock | Tissue lost (mean, max) | Cleared / contained / backup |
| -------- | -------- | ------- | ---------- | ------------------------------- | ---------------------- | ----------------------- | ---------------------------- |
| home     | skirmish | 430     | 1.03       | 1: 416, 2: 14                   | 100%                   | 0.00, 0                 | 430 / 0 / 0                  |
| smarter  | full     | 216     | 1.00       | 1: 216                          | 100%                   | 0.00, 0                 | 216 / 0 / 0                  |
| smarter  | skirmish | 277     | 1.04       | 1: 266, 2: 11                   | 100%                   | 0.00, 0                 | 277 / 0 / 0                  |
| skipMeds | full     | 229     | 1.06       | 1: 215, 2: 14                   | 100%                   | 0.01, 1                 | 191 / 38 / 0                 |
| skipMeds | skirmish | 270     | 1.61       | 1: 107, 2: 161, 3: 2            | 99%                    | 0.01, 1                 | 270 / 0 / 0                  |
| risky    | full     | 434     | 1.45       | 1: 324, 2: 70, 3: 9, 4-6: 31    | 99%                    | 0.27, 7                 | 402 / 32 / 0                 |
| mixed    | full     | 341     | 1.40       | 1: 239, 2: 79, 3-5: 23          | 100%                   | 0.22, 6                 | 271 / 70 / 0                 |
| careless | full     | 478     | 2.12       | 1: 201, 2: 145, 3: 62, 4-6: 70  | 95%                    | 2.22, 20                | 32 / 404 / 42                |

Week-1 battles replayed with other players on the same loadout:

| Loadout (bot, med level) | Pathogens at start | Thoughtful: turns, lost | `hold` (does nothing): lost, backup | `engulfAll` (no charges, no thought): lost, backup |
| ------------------------ | ------------------ | ----------------------- | ----------------------------------- | -------------------------------------------------- |
| smarter full, 1.00       | 1.2                | 1.00, 0.00              | 14.9, 100%                          | 0.1, 0%                                            |
| skipMeds full, 0.00      | 1.2                | 1.06, 0.02              | 17.5, 100%                          | 0.1, 0%                                            |
| risky full, 1.00         | 2.0                | 1.39, 0.18              | 18.0, 100%                          | 0.2, 0%                                            |
| careless full, 0.00      | 2.0                | 1.83, 0.78              | 19.3, 100%                          | 0.2, 0%                                            |
| any skirmish             | 2.4                | 1.0-1.6, 0.00-0.04      | 8.0-8.9, 100%                       | 0.3-0.4, 0%                                        |

Reading: the battle is binary. Doing anything wins; doing nothing loses everything. A bot with no
judgement (`engulfAll`) does as well as the thoughtful one. Medication changes nothing measurable in
a full battle (smarter 0.00 vs skipMeds 0.02 tissue). The only real losses are careless week 2
(reservoirs plus fresh exposures, no meds, no doctor): 42 of 478 full battles needed backup, and
those lose 16-20 tissue, a cliff rather than a slope.

### 1.2 Why (rule by rule)

1. **Everything is in reach on turn 1.** Swarms start on row 6 (`params.ts:141-145`) with move range
   3 (`params.ts:12`) and engulf any edge-adjacent pathogen after the move (`orders.ts:124`), so the
   reach is 4 rows. Exposures enter on row 2 (`params.ts:146-155`, card `at` lists at `:213-262`)
   and skirmish threats on rows 1-4 (`params.ts:328-335`): distance 4 from the start line. Almost
   every threat is engulfed before it ever acts.
2. **The battle ends the moment the board is empty.** `battleStatus` (`outcome.ts:19-26`) ends on
   "no visible pathogen". Engulfing a sealed germ moves it into the swarm's load, off the board, so
   the engulf that contains it also ends the fight. The core CGD tension in `pitch-4.md` (a loaded
   swarm is slow and hot; walling costs two turns; carried loads get a kill roll each turn,
   `params.ts:109`) never gets a second turn to matter.
3. **Fewer enemies than swarms, and no new ones.** A full battle starts with 1.2-2.0 pathogens, a
   skirmish with 2.4, against 3 swarms (`params.ts:5`). Nothing arrives mid-battle. It is a
   one-to-one assignment problem, solved by "nearest swarm engulfs nearest germ".
4. **Turn 1 telegraphs nothing worth reading.** A size-1 strep must grow before it can spread, and
   mold and staph need size 3 (`intents.ts:82`, `params.ts:36-66`). Skirmish germs are size 1
   (`params.ts:327`) and exposures size 1-2, so the first telegraph is mostly "grow", and by turn 2
   they are gone.
5. **Medication only matters if the fight lasts.** The aura is a 30% stall chance at full meds
   (`params.ts:124`) and charges (`:127-131`) are a convenience when swarms can engulf everything
   anyway. `Loadout.load` exists to make exposures bigger (`setup.ts:63-66`) but is always 0
   (`loadout.ts:97`, `:127`). Hence the stopgap `perDose: 30` (`params.ts:368`, b1a-design 1.2
   update): skipping a dose costs score, not anything the player sees inside the body.
6. **When it does go wrong, it collapses.** Careless week 2 has up to 2 reservoirs, 2-3 exposures,
   0 charges and no stall. Loaded swarms slow down and heat their tiles, spread outpaces them, and
   tissue drains for every remaining turn down to 0-4, past the backup line (`params.ts:172`)
   because the battle keeps running to `maxTurns` after backup is already certain.

In short: the fight is decided by the setup geometry, it ends on the first good move, and the life
choices that should shape it (doses above all) do not reach it.

## 2. Design principles for this audience

1. **Legible in one look.** Every new threat is telegraphed a full turn ahead, on the board, with a
   number and an icon, never in a tooltip only. A player who reads the board and moves sensibly
   never meets a surprise except hidden reservoirs, which already exist and are the point.
2. **Choices, not chores.** A turn is worth playing when at least two orders are reasonable and
   they lead to visibly different futures (guard here or finish that; carry it or wall it). Walking
   turns are fine only if the telegraph already shows why you are walking.
3. **No punishment spiral.** Bad setups make the fight harder, never hopeless. Help arrives the
   moment things go badly (backup), the battle stops, and nobody watches tissue drain to zero.
   Reservoir caps stay (`params.ts:322`).
4. **No blame for infections.** Exposures land whatever the player does. Copy describes what is
   happening ("more spores from the yard"), never "because you". The consequence of a skipped dose
   is shown as what the medicine does when it is there, not as a scolding when it is not.
5. **Choices echo real life.** Meds taken or skipped, risky vs smarter activities, a reservoir
   carried in, an early doctor visit: each must change something the player can see on the board.
   Skill moves the result within the range those choices set (`fodder.md` design risk: battle skill
   must not fully overcome bad prep).
6. **Colour never carries meaning alone.** New marks get a shape, an icon and a number or word, and
   must pass the B7 grayscale check (palette rules in `b1a-design.md` section 4).
7. **Touch first, phone possible.** No new information that needs hover. Tap targets at least 44px.
   Any new per-turn information fits one line of the status strip or the stats row in portrait.
8. **Short sessions.** A full battle should take about 3-4 minutes for a human (4-6 turns at
   20-40 seconds), a skirmish about 1.5 minutes (3-4 turns). Longer is not better.
9. **Accurate enough to trust.** Every new rule has a one-line clinical story, or is openly a game
   rule. Anything we are unsure of goes to `clinician-questions.md` with a working assumption.

## 3. Options

### Option A: Waves and a battle clock

**Rules in plain language.**

- **A fixed clock.** A full battle lasts 6 turns and a skirmish 4. "Turn 3 of 6" is always shown. The
  battle ends early only when the board is clear _and_ no arrival is still due ("all clear").
- **Germs keep arriving.** Each landed exposure arrives at a "door" (an entry tile on the far edge,
  row 0 or the side columns) instead of mid-board, and sends a second, smaller group two turns later
  ("more spores from the yard"). A skirmish sends its 2-3 strep in two groups (turns 1 and 3).
- **Arrivals are telegraphed.** The turn before a group arrives, its door shows an "incoming" mark:
  a ring at the door with the organism icon and a count, plus "arrives next turn". A swarm standing on
  the door when the group arrives meets it there: the group is blocked, exactly like a spread onto a
  swarm today (Blocked event). Leaky arrivals blocked this way die; sealed ones are blocked but come
  back next turn at the nearest free door (no free kills on sealed germs).
- **Missed doses make arrivals bigger.** Every dose missed in the 3-day window adds 1 to the size of
  every arriving germ (cap 4). This uses the existing `Loadout.load` field. Full meds: the yard's mold
  arrives at size 2, inside the charge limit. One miss: size 3, it can spore on its first turn and is
  too big for a normal charge. The aura's stall chance stays as it is.
- **Backup ends the fight.** When tissue health reaches the backup line (10), backup arrives at once
  and the battle ends as "needed backup". The player never watches tissue drain to 0.
- **Pacing curve.** Turn 1 shows one or two germs and one incoming mark (calm), turns 2-4 hold the
  peak (second groups, a flared reservoir, spores), turns 5-6 are mop-up and the choice to carry or
  wall what was swallowed.

**Worked example (risky week, one dose missed, turn 2 of 6).** On the board: a size-3 Aspergillus
at the right door (5,0) telegraphing "spore to (2,3)" (size 2 plus 1 for the missed dose), and a
Streptococcus pair from the lake at (1,1) and (1,2) (it arrived at size 2 and spread once), one
telegraphing "spread to (2,2)". The incoming mark at the left door (0,1) says "Staphylococcus x1,
size 2, next turn". Swarm s1 can engulf the strep at (1,2) (a kill) or step onto the left door to
meet the staph. s2 can stand on (2,3) to block the spore or walk toward the mold. s3 is free, in the
middle. The player blocks the spore with s2, kills
strep with s1, and sends s3 to the door: the staph is met at the door, comes back next turn, and the
second strep spreads once. Three reasonable plans existed; each leaves a different board on turn 3.

**What changes.**

- `src/sim/params.ts`: `waves` block (doors, second-group delay and size, skirmish split), full
  `maxTurns` 6 stays, skirmish `maxTurns` 3 to 4, exposure `at` lists move to door tiles.
- `src/sim/types.ts`, `src/sim/validate.ts`: `BattleState.arrivals` (turn, kind, size, door).
- `src/sim/life/loadout.ts`: `load` = doses missed in the window; skirmish exposures split into two
  groups.
- `src/sim/battle/setup.ts`: build the arrival schedule from exposures; reservoirs unchanged.
- `src/sim/battle/intents.ts`: arrivals due next turn become telegraph marks (type `arrive`, `from`
  and `to` both the door), so `blockedBy` and the bots' `landingTargets` work unchanged.
- `src/sim/battle/resolve.ts`: arrivals land in the intents phase.
- `src/sim/battle/outcome.ts`: not over while arrivals are pending; over at the backup line.
- `src/render/telegraphView.ts`: the incoming mark (door ring, icon, count badge, halo stroke);
  `src/render/playback.ts` / `playbackView.ts`: an arrival beat; `src/ui/hud.ts`: "Turn 3 of 6" and
  "Next: 1 Staph, turn 3" in the stats row; key and how-to-play lines; `src/ui/outcome.ts`: "Backup
  arrived" copy.
- Tests: `outcome.test.ts`, `setup.test.ts`, `resolve.test.ts`, `campaign.test.ts` skirmish block,
  `battle/balance.test.ts`, `campaign.balance.test.ts`, `score.balance.test.ts` thresholds.

**Slices (about 18 hours).** A1 sim: arrivals, doors, schedule, end rules, backup stop (6h). A2
missed doses to `load`, skirmish split, retune and balance tests (4h). A3 incoming mark, arrival
playback, turn clock and next-arrival line, key text (6h). A4 copy and outcome screen (2h).

**Risks.** Longer battles lengthen the session (mitigated by the clock and "all clear"). Door tiles
add visual load at the far edge of a small board. Retuning touches several balance tests. A
size-bonus per missed dose could feel harsh if it stacks with reservoirs (cap arrivals at size 4, and
reservoirs are not affected).

**Score impact.** `PARAMS.score` keys unchanged; `fight` and `perTissue` now actually spread, so
Outcome stops being a near-constant 100. Once the survey shows skipMeds losing at least 40 Outcome per
campaign against smarter, lower `perDose` from 30 to 15 and bump `score.version` to 4. Bots: careful
and saveForCharge read arrivals through the telegraph and guard doors with no code change; the
skirmish threshold "cleared > 95%" in `campaign.test.ts` will need loosening to about 85%.

**Clinical story.** An exposure is not one instant: spores and bacteria keep coming in from the
source for a while, and neutrophils meet them where they enter. Prophylaxis means fewer germs get a
foothold, shown as smaller arrivals. Honest and simple. Needs no new clinician item beyond a wording
check on "medicine keeps germs small when they arrive".

**Phone.** Doors sit on the far edge (top of the board in portrait). The incoming mark is a thick
ring plus a badge of at least 24px with the count; tapping a door shows the arrival in the info card.
The clock and next-arrival line take one row in the stats area, no extra panel.

### Option B: Inside the cell (the swallowed fight)

**Rules in plain language.**

- **Swallowing does not end the battle.** A sealed germ in a swarm stays "alive inside" and keeps
  the fight open (shown as a pip on the swarm). The battle ends when no germ is free and nothing is
  alive inside a free swarm, or at the clock (6 turns; walled contents do not keep it open).
- **Medicine helps finish what was swallowed.** Each turn a carried sealed germ is rolled to die:
  the residual chance (0.10) plus a medication bonus (+0.25 at full meds, scaled by med level). The
  chance is printed on the pip: "35% this turn". With doses skipped it reads "10% this turn".
- **Carrying costs.** As today: a loaded swarm moves less and heats its tile each turn. After 2 turns
  carried, a sealed germ grows by 1 inside the swarm (it survives in there and multiplies), so
  carrying forever is not free and walling off becomes a real choice.
- **Three answers to a load:** keep carrying and hope the roll lands (better with meds), wall it off
  (certain containment, a granuloma, two turns of the swarm), or spend a charge on the load.

**Worked example (smarter week, full meds, turn 3 of 6).** s2 swallowed a size-2 Staph on turn 2.
Its pip reads "35% this turn". The tile under s2 is warm (1). A strep pair is coming down the left
side. Carry: s2 can still move 2, it can help with the strep, and has a 35% roll each turn, but its
tile will be hot by turn 4 and the staph grows to 3 on turn 4. Wall off: certain, but s2 is out for
two turns and the left side is short a swarm. Antibacterial charge on the load: certain kill, but
then no charge for the strep. With doses skipped the same pip reads 10%, which turns "carry" into
"wall it".

**What changes.** `src/sim/battle/outcome.ts` (end rule), `src/sim/battle/orders.ts`
(`applyCarriedKills` chance with med bonus, growth inside), `src/sim/params.ts` (`meds.carriedKillBonus`,
`carriedGrowAfter`), `src/render/swarmView.ts` (pips with a size), `src/ui/hud.ts` and the info card
(the % line), `src/render/playback.ts` (a "finished inside" flash). Tests: `engulf.test.ts`,
`walloff.test.ts`, `outcome.test.ts`, balance tests.

**Slices (about 12 hours).** B1 end rule and med bonus on the carried roll (4h). B2 growth inside,
retune (3h). B3 pips, % line, kill flash (5h).

**Risks.** It does nothing for the skirmish (leaky strep only, which dies on engulf), the most common
battle (49-72% of weeks): skirmishes stay at 1-2 turns. A per-turn percentage is a dice moment; a
streak of misses can feel unfair. "Grows inside the cell" is a vivid image that must not read as
frightening.

**Score impact.** More "cleared" with full meds (fight 40 instead of 20, and `carryClear` 20 instead
of 10 or 0), so skipped doses cost Outcome on weeks with a sealed exposure. `perDose` can drop to
about 20. Bots: `careful` needs a rule for carry vs wall (wall at chance below 20% or when the germ
is about to grow), which is a small bot change.

**Clinical story.** The strongest of the three. Catalase-positive organisms survive inside CGD
phagocytes, which is why granulomas form. The prophylactic antibacterial (TMP-SMX) is commonly
explained as concentrating inside phagocytes and helping them kill what they took up. The antifungal
part is less clear. New clinician item, priority A: "Is 'prophylaxis helps cells finish germs they
already swallowed' a fair picture for the antibacterial, and for the antifungal?" Working
assumption: yes for the antibacterial, softer wording for the antifungal.

**Phone.** The % lives on the swarm's info card (tap a swarm), plus a small number on the pip. Fits
the existing layout.

### Option C: Terrain and lanes (positioning layer)

**Rules in plain language.** Each map gets two kinds of special tile. **Airways** are lanes where
spread and spores travel two tiles instead of one, so germs race along them. **Vessels** are tiles
where swarms move one extra step (blood flow carries cells in; chemotaxis is intact). The board
becomes a puzzle of holding the airway mouths and using vessels to reposition. Germ count and
everything else stay as now.

**Worked example.** A mold sits at the top of an airway that runs down to row 4. Its spore
telegraph lands at the bottom of the airway, 4 tiles away. s1 stands on a vessel tile and can reach
the landing tile with its extra step; s3 cannot. Holding the airway mouth would stop the next spore
but leaves the strep on the right free.

**What changes.** `src/sim/board.ts` (tile types, path costs), `src/sim/battle/intents.ts` (lane
targets), `src/sim/battle/orders.ts` (move range on vessels), the map data, `src/render/boardView.ts`
and `tissueTexture.ts` (lanes and vessels drawn on the organic board), the key, every test that
assumes a uniform board (the ~329 tests mostly do).

**Slices (about 25 hours).** Board types and pathing (6h), lane spread and spores (5h), rendering
lanes and vessels so they read in grayscale and on a phone (8h), retune and tests (6h).

**Risks.** Highest cost, most test churn, and it does not by itself fix the "ends on turn 1" rule or
the meds link. Two more visual languages on a small board fight the telegraph for attention.

**Score impact.** None directly. Bots need path awareness of lanes (moderate change).

**Clinical story.** Plausible for the lung (bronchopneumonia follows airways; cells arrive by blood)
but it teaches anatomy, not CGD, and does not touch the life-phase link.

**Phone.** Worst of the three: lanes and vessels need patterns plus labels on tiles that are about
45px wide in portrait.

### Comparison

| | A: Waves and clock | B: Inside the cell | C: Terrain |
| --- | --- | --- | --- |
| Fixes "ends in 1-2 turns" | Yes, both kinds | Full battles only | No |
| Adds real choices | Guard the door vs chase; meet vs block | Carry vs wall vs charge | Hold the lane vs reposition |
| Makes skipped doses bite in battle | Yes, visibly (bigger arrivals) | Yes (lower finish chance) | No |
| Clinical strength | Good | Best | Fair |
| Cost | About 18h | About 12h | About 25h |
| Phone | Good | Good | Poor |

## 4. Recommendation

**Build Option A, plus the medicine half of Option B.** A fixes the felt problem everywhere (length,
a reason to read the telegraph, a visible link to doses), and it is mostly data and one new mark.
B's "medicine helps finish what was swallowed" is one small rule on an existing roll that makes the
5-6 turn tail of a full battle meaningful and carries the best clinical story. Option C goes to the
post-beta backlog.

**The smallest version (about 20 hours, five slices, in order):**

1. **Clock and backup stop (3h).** Full battles end at 6 turns or "all clear"; a skirmish lasts up to
   4. The battle ends at once when tissue reaches 10. Doors replace the row-2 entry tiles, so first
   contact is on turn 2. Done when: survey shows full-battle mean turns at least 3.5.
2. **Arrivals (6h).** Second groups from each exposure, the skirmish in two groups, door blocking.
   Telegraph marks of type `arrive`. Done when: the bots guard doors with no bot change.
3. **Missed doses make arrivals bigger (2h).** `Loadout.load` = doses missed in the window. Done when:
   skipMeds loses at least 2 tissue more than smarter per full battle on matched seeds.
4. **Incoming mark and clock in the UI (6h).** Door ring with icon and count, arrival beat in
   playback, "Turn 3 of 6" and "Next: ..." in the stats row, key line, outcome copy for backup.
   Done when: screenshots at 1280x800 and 390x844, grayscale check passes.
5. **Medicine finishes swallowed germs (3h).** Carried roll = residual + 0.25 x med level; the % on
   the swarm info card. No growth inside the cell in the beta. Done when: smarter full battles clear
   at least 15 points more often than skipMeds.

**Cut line, in order, if the schedule slips:**

1. Slice 5 (medicine on the carried roll): the battle still works; doses still bite through slice 3.
2. The arrival beat animation in slice 4 (germs just appear; the incoming mark stays).
3. Second groups for full battles in slice 2 (keep the skirmish split and the doors).

**Never cut:** slice 1 (the clock and backup stop) and slice 3 (doses reach the battle). Slice 1
plus slice 3 alone (about 5 hours plus a minimal "Turn N of 6" label) is the floor that still answers
the tester: longer battles, a real cost to skipped doses, no spiral.

**Verify with the patient tester (B9 session, use the session log and the prediction probe):**

1. Length: after each battle, "too short, about right, or too long?" Target: "about right" for full
   battles; log the time per battle (target 2-5 minutes).
2. Legibility: before ending a turn, ask "where will the next germ show up?" (the probe). Target: the
   door is predicted correctly at least 3 times out of 4 after the first battle.
3. Choice: ask them to say out loud why they made one turn's orders. A real choice is one where they
   mention a trade-off.
4. Doses: play one week skipping a dose. Ask "did that change anything in the fight?" and "did that
   feel fair?" Target: they name the bigger germs, and say it felt fair, not preachy.
5. Fear check: "did any fight feel hopeless or scary?" Any "yes" is a priority fix, not a tuning note.
6. Phone (if time): tap a door and a swarm; read the incoming mark at arm's length.

## 5. Bot and balance plan

Extend `src/sim/score.balance.test.ts` (or a new `src/sim/battle.depth.balance.test.ts` shaped like
it) to print, per bot, the battle table of section 1.1 plus the score table. 300 seeds, two weeks,
thoughtful play, as today. Add two players inside the test file only (not in `CAMPAIGN_BOTS`):

- `engulfAll` with no charges, as a stand-in for a new human who has not read anything;
- `hold`, to confirm that doing nothing still fails.

**Targets (thoughtful play unless stated):**

| Measure | home | smarter | risky | mixed | skipMeds | careless |
| --- | --- | --- | --- | --- | --- | --- |
| Full battle mean turns | (no full) | 4-6 | 4.5-6 | 4.5-6 | 4.5-6 | 5-6 |
| Skirmish mean turns | 3-4 | 3-4 | 3-4 | 3-4 | 3-4 | 3-4 |
| Tissue lost per full battle | n/a | 0.5-3 | 2-5 | 2-5 | 3-6 | 5-9 |
| Tissue lost per skirmish | 0-1.5 | 0-1.5 | 0-1.5 | 0-2 | 1-3 | 1-3 |
| Full battles needing backup | n/a | 0-3% | 0-8% | 0-8% | 3-12% | 10-25% |
| Full battles cleared | n/a | at least 60% | 40-75% | 40-75% | 20-50% | 5-30% |
| Skirmishes cleared | at least 85% | at least 85% | at least 85% | at least 80% | 65-90% | 60-90% |

Plus these relations (each an assertion):

1. **Doing nothing still fails:** `hold` needs backup in at least 90% of full battles and leaves the
   skirmish loose in at least 90%.
2. **Thinking pays:** thoughtful loses at least 2 tissue less than `engulfAll` per full battle, and
   clears at least 15 points more often (today the gap is 0).
3. **Doses reach the battle:** on matched seeds and the same smarter cards, skipMeds loses at least 2
   tissue more per full battle and clears at least 15 points less often than smarter.
4. **No spiral:** no battle loses more than 10 tissue (the backup stop makes this structural), and
   the careless week-2 backup rate is at most 25% (today 42 of 478 battles end at 0-4 tissue).
5. **Score order holds:** smarter > mixed > careless > home and smarter > risky, as in the existing
   test. After `perDose` drops to 15, the skipMeds total gap to smarter stays at least 120 per
   campaign (today 183, all from Choices).
6. **Turn time:** not measurable by bots; checked in the tester session (2-5 minutes per full
   battle). If the clock makes sessions too long, the first knob is full `maxTurns` 6 to 5.

Tuning knobs, in the order to try: second-group delay and size (`waves`), skirmish `maxTurns` (3-5),
size per missed dose (1, or 1 only at 2+ misses), the medicine bonus on the carried roll (0.15-0.35),
door positions. Leave `inflammation.damageThreshold` alone (b1a-design 3.2 explains why).

## 6. Open questions for Tracy

1. Build Option A plus the medicine half of B (section 4), and put C in the post-beta backlog?
   **Suggested: yes.**
2. Fixed clock: full battles 6 turns, skirmishes 4, ending early only on "all clear" (board empty and
   nothing still arriving)? **Suggested: yes.**
3. When tissue reaches 10, backup arrives and the battle ends at once, instead of playing out to the
   last turn? **Suggested: yes**; it removes the spiral and the grade does not change.
4. Each missed dose in the 3-day window makes arriving germs one size bigger (deterministic, shown on
   the incoming mark), rather than a random effect? **Suggested: yes**; it is legible and testable.
5. Medicine raises the chance that cells finish a swallowed germ each turn, with the % shown on the
   swarm, and this goes to the clinician list as a priority A question? **Suggested: yes.**
6. Once the balance survey shows doses biting in battle, lower `PARAMS.score.perDose` from 30 to 15
   and bump the score version (best scores reset)? **Suggested: yes.**
7. Sealed germs met at a door are blocked but come back next turn, rather than dying, so the door is
   never a free kill on Staph or Aspergillus? **Suggested: yes**; it keeps the CGD rule intact.
8. No score bonus for an early "all clear" (the formula already rewards tissue kept)?
   **Suggested: yes.**
9. Schedule: do these slices now, before B1 (mobile), because B1 has to fit the clock and the
   incoming mark; pay for it by cutting the epilogue (B6) as the plan already allows?
   **Suggested: yes.**
